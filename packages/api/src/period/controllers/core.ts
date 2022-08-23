import { Types } from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import { Request, Response } from 'express';
import { Parser } from 'json2csv';
import { add, compareAsc, parseISO } from 'date-fns';
import { BadRequestError, NotFoundError } from '@/error/errors';
import { PraiseDtoExtended, PraiseDetailsDto, PraiseDto } from '@/praise/types';
import {
  praiseListTransformer,
  praiseTransformer,
} from '@/praise/transformers';
import { calculateQuantificationScore } from '@/praise/utils/score';
import { UserModel } from '@/user/entities';
import { UserAccountModel } from '@/useraccount/entities';
import { insertNewPeriodSettings } from '@/periodsettings/utils';
import { settingValue } from '@/shared/settings';
import {
  TypedRequestBody,
  TypedResponse,
  QueryInput,
  PaginatedResponseBody,
  QueryInputParsedQs,
  TypedRequestQuery,
} from '@/shared/types';
import { getQueryInput, getQuerySort } from '@/shared/functions';
import { PraiseModel } from '@/praise/entities';
import { EventLogTypeKey } from '@/eventlog/types';
import { logEvent } from '@/eventlog/utils';
import {
  PeriodDetailsDto,
  PeriodUpdateInput,
  PeriodQuantifierPraiseInput,
  PeriodStatusType,
  PeriodReceiverPraiseInput,
} from '../types';
import {
  findPeriodDetailsDto,
  getPeriodDateRangeQuery,
  getPreviousPeriodEndDate,
  getSummarizedReceiverData,
  isPeriodLatest,
} from '../utils/core';
import { PeriodModel } from '../entities';
import {
  periodReceiverListTransformer,
  periodTransformer,
} from '../transformers';

/**
 * Fetch a paginated list of Periods
 *
 * @param {TypedRequestQuery<QueryInputParsedQs>} req
 * @param {(TypedResponse<PaginatedResponseBody<PeriodDetailsDto | undefined>>)} res
 * @returns {Promise<void>}
 */
export const all = async (
  req: TypedRequestQuery<QueryInputParsedQs>,
  res: TypedResponse<PaginatedResponseBody<PeriodDetailsDto | undefined>>
): Promise<void> => {
  const query = getQueryInput(req.query);

  const response = await PeriodModel.paginate({
    ...query,
    sort: getQuerySort(req.query),
  });

  const periodList = response?.docs;
  if (periodList && Array.isArray(periodList) && periodList.length > 0) {
    const periodDetailsDto: PeriodDetailsDto[] = [];
    for (const period of periodList) {
      if (period?.status === PeriodStatusType.QUANTIFY) {
        const periodDetails = await findPeriodDetailsDto(period._id);
        periodDetailsDto.push(periodDetails);
        continue;
      }
      periodDetailsDto.push(periodTransformer(period));
    }
    res.status(StatusCodes.OK).json({
      ...response,
      docs: periodDetailsDto,
    });
  } else {
    res.status(StatusCodes.OK).json({
      ...response,
      docs: [],
    });
  }
};

/**
 * Fetch a single Period
 *
 * @param {Request} req
 * @param {TypedResponse<PeriodDetailsDto>} res
 * @returns {Promise<void>}
 */
export const single = async (
  req: Request,
  res: TypedResponse<PeriodDetailsDto>
): Promise<void> => {
  const { periodId } = req.params;
  const periodDetailsDto = await findPeriodDetailsDto(periodId);
  res.status(StatusCodes.OK).json(periodDetailsDto);
};

/**
 * Create a Period
 *
 * @param {TypedRequestBody<PeriodUpdateInput>} req
 * @param {TypedResponse<PeriodDetailsDto>} res
 * @returns {Promise<void>}
 */
export const create = async (
  req: TypedRequestBody<PeriodUpdateInput>,
  res: TypedResponse<PeriodDetailsDto>
): Promise<void> => {
  const { name, endDate: endDateInput } = req.body;

  if (!name || !endDateInput)
    throw new BadRequestError('Period name and endDate are required');

  const endDate = parseISO(endDateInput);

  const latestPeriod = await PeriodModel.getLatest();
  if (latestPeriod) {
    const earliestDate = add(latestPeriod.endDate, { days: 7 });
    if (compareAsc(earliestDate, endDate) === 1) {
      throw new BadRequestError(
        'End date must be at least 7 days after the latest end date'
      );
    }
  }

  const period = await PeriodModel.create({ name, endDate });
  await insertNewPeriodSettings(period);

  await logEvent(
    EventLogTypeKey.PERIOD,
    `Created a new period "${period.name}"`,
    {
      userId: res.locals.currentUser._id,
    }
  );

  const periodDetailsDto = await findPeriodDetailsDto(period._id);

  res.status(StatusCodes.OK).json(periodDetailsDto);
};

/**
 * Description
 * @param
 */
/**
 * Update a Period's endDate or name
 *
 * @param {TypedRequestBody<PeriodUpdateInput>} req
 * @param {TypedResponse<PeriodDetailsDto>} res
 * @returns {Promise<void>}
 */
export const update = async (
  req: TypedRequestBody<PeriodUpdateInput>,
  res: TypedResponse<PeriodDetailsDto>
): Promise<void> => {
  const period = await PeriodModel.findById(req.params.periodId);
  if (!period) throw new NotFoundError('Period');

  const { name, endDate } = req.body;

  if (!name && !endDate)
    throw new BadRequestError('Updated name or endDate to must be specified');

  const eventLogMessages = [];

  if (name) {
    eventLogMessages.push(
      `Updated the name of period "${period.name}" to "${name}"`
    );

    period.name = name;
  }

  if (endDate) {
    const latest = await isPeriodLatest(period);
    if (!latest)
      throw new BadRequestError('Date change only allowed on latest period.');

    if (period.status !== PeriodStatusType.OPEN)
      throw new BadRequestError('Date change only allowed on open periods.');

    try {
      const newEndDate = parseISO(endDate);

      eventLogMessages.push(
        `Updated the end date of period "${
          period.name
        }" to ${endDate.toString()} UTC`
      );

      period.endDate = newEndDate;
    } catch (e) {
      throw new BadRequestError('Invalid date format.');
    }
  }

  await period.save();

  await logEvent(EventLogTypeKey.PERIOD, eventLogMessages.join(', '), {
    userId: res.locals.currentUser._id,
  });

  const periodDetailsDto = await findPeriodDetailsDto(period._id);
  res.status(StatusCodes.OK).json(periodDetailsDto);
};

/**
 * Close a Period (change status from 'QUANTIFY' to 'CLOSED')
 *
 * @param {Request} req
 * @param {TypedResponse<PeriodDetailsDto>} res
 * @returns {Promise<void>}
 */
export const close = async (
  req: Request,
  res: TypedResponse<PeriodDetailsDto>
): Promise<void> => {
  const period = await PeriodModel.findById(req.params.periodId);
  if (!period) throw new NotFoundError('Period');

  if (period.status === PeriodStatusType.CLOSED)
    throw new BadRequestError('Period is already closed');

  period.status = PeriodStatusType.CLOSED;
  await period.save();

  await logEvent(EventLogTypeKey.PERIOD, `Closed the period "${period.name}"`, {
    userId: res.locals.currentUser._id,
  });

  const periodDetailsDto = await findPeriodDetailsDto(period._id);

  res.status(StatusCodes.OK).json(periodDetailsDto);
};

/**
 * Fetch all Praise in a period
 *
 * @param {Request} req
 * @param {TypedResponse<PraiseDto[]>} res
 * @returns {Promise<void>}
 */
export const praise = async (
  req: Request,
  res: TypedResponse<PraiseDto[]>
): Promise<void> => {
  const period = await PeriodModel.findById(req.params.periodId);
  if (!period) throw new NotFoundError('Period');

  const previousPeriodEndDate = await getPreviousPeriodEndDate(period);

  const praiseList = await PraiseModel.find()
    .where({
      createdAt: { $gt: previousPeriodEndDate, $lte: period.endDate },
    })
    .sort({ createdAt: -1 })
    .populate('receiver giver forwarder');

  const praiseDetailsDtoList: PraiseDetailsDto[] = [];
  if (praiseList) {
    for (const praise of praiseList) {
      praiseDetailsDtoList.push(await praiseTransformer(praise));
    }
  }

  res.status(StatusCodes.OK).json(praiseDetailsDtoList);
};

/**
 * Fetch all Praise in a period with a given receiver
 *
 * @param {TypedRequestQuery<PeriodReceiverPraiseInput>} req
 * @param {TypedResponse<PraiseDto[]>} res
 * @returns {Promise<void>}
 */
export const receiverPraise = async (
  req: TypedRequestQuery<PeriodReceiverPraiseInput>,
  res: TypedResponse<PraiseDto[]>
): Promise<void> => {
  const period = await PeriodModel.findById(req.params.periodId);
  if (!period) throw new NotFoundError('Period');

  const { receiverId } = req.query;
  if (!receiverId) throw new BadRequestError('Receiver Id is a required field');

  const previousPeriodEndDate = await getPreviousPeriodEndDate(period);

  const praiseList = await PraiseModel.find()
    .where({
      createdAt: { $gt: previousPeriodEndDate, $lte: period.endDate },
      receiver: new Types.ObjectId(receiverId),
    })
    .sort({ createdAt: -1 })
    .populate('receiver giver forwarder');

  const praiseDetailsDtoList: PraiseDetailsDto[] = [];
  if (praiseList) {
    for (const praise of praiseList) {
      praiseDetailsDtoList.push(await praiseTransformer(praise));
    }
  }

  res.status(StatusCodes.OK).json(praiseDetailsDtoList);
};

/**
 * Fetch all praise in a period assigned to a given quantifier
 *
 * @param {TypedRequestQuery<PeriodQuantifierPraiseInput>} req
 * @param {TypedResponse<PraiseDto[]>} res
 * @returns {Promise<void>}
 */
export const quantifierPraise = async (
  req: TypedRequestQuery<PeriodQuantifierPraiseInput>,
  res: TypedResponse<PraiseDto[]>
): Promise<void> => {
  const period = await PeriodModel.findById(req.params.periodId);
  if (!period) throw new NotFoundError('Period');

  const { quantifierId } = req.query;
  if (!quantifierId)
    throw new BadRequestError('Quantifier Id is a required field');

  const periodDateRangeQuery = await getPeriodDateRangeQuery(period);

  const praiseList = await PraiseModel.find({
    createdAt: periodDateRangeQuery,
    'quantifications.quantifier': new Types.ObjectId(quantifierId),
  });

  await PraiseModel.populate(praiseList, { path: 'receiver giver forwarder' });

  const response = await praiseListTransformer(praiseList);
  res.status(StatusCodes.OK).json(response);
};

/**
 * Generate a CSV of Praise and quantification data for a period
 *
 * @param {TypedRequestBody<QueryInput>} req
 * @param {Response} res
 * @returns {Promise<void>}
 */
export const exportPraise = async (
  req: TypedRequestBody<QueryInput>,
  res: Response
): Promise<void> => {
  const period = await PeriodModel.findOne({ _id: req.params.periodId });
  if (!period) throw new NotFoundError('Period');
  const periodDateRangeQuery = await getPeriodDateRangeQuery(period);

  const praises = await PraiseModel.find({
    createdAt: periodDateRangeQuery,
  }).populate('giver receiver forwarder');

  const quantificationsColumnsCount = (await settingValue(
    'PRAISE_QUANTIFIERS_PER_PRAISE_RECEIVER',
    period._id
  )) as number;

  const docs: PraiseDetailsDto[] = [];
  if (praises) {
    for (const praise of praises) {
      const pws: PraiseDtoExtended = await praiseTransformer(praise);

      const receiver = await UserModel.findById(pws.receiver.user);
      if (receiver) {
        pws.receiverUserDocument = receiver;
      }

      if (pws.giver && pws.giver.user) {
        const giver = await UserModel.findById(pws.giver.user);
        if (giver) {
          pws.giverUserDocument = giver;
        }
      }

      pws.quantifications = await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pws.quantifications.map(async (q: any) => {
          const quantifier = await UserModel.findById(q.quantifier._id);
          const account = await UserAccountModel.findOne({
            user: q.quantifier._id,
          });

          q.quantifier = quantifier;
          q.account = account;

          q.scoreRealized = await calculateQuantificationScore(q);

          return q;
        })
      );

      docs.push(pws);
    }
  }

  const fields = [
    {
      label: 'ID',
      value: '_id',
    },
    {
      label: 'DATE',
      value: 'createdAt',
    },
    {
      label: 'TO USER ACCOUNT',
      value: 'receiver.name',
    },
    {
      label: 'TO USER ACCOUNT ID',
      value: 'receiver._id',
    },
    {
      label: 'TO ETH ADDRESS',
      value: 'receiverUserDocument.ethereumAddress',
    },
    {
      label: 'FROM USER ACCOUNT',
      value: 'giver.name',
    },
    {
      label: 'FROM USER ACCOUNT ID',
      value: 'giver._id',
    },
    {
      label: 'FROM ETH ADDRESS',
      value: 'giverUserDocument.ethereumAddress',
    },
    {
      label: 'REASON',
      value: 'reasonRealized',
    },
    {
      label: 'SOURCE ID',
      value: 'sourceId',
    },
    {
      label: 'SOURCE NAME',
      value: 'sourceName',
    },
  ];

  for (let index = 0; index < quantificationsColumnsCount; index++) {
    const quantObj = {
      label: `SCORE ${index + 1}`,
      value: `quantifications[${index}].score`,
    };

    fields.push(quantObj);
  }

  for (let index = 0; index < quantificationsColumnsCount; index++) {
    const quantObj = {
      label: `DUPLICATE ID ${index + 1}`,
      value: `quantifications[${index}].duplicatePraise`,
    };

    fields.push(quantObj);
  }

  for (let index = 0; index < quantificationsColumnsCount; index++) {
    const quantObj = {
      label: `DISMISSED ${index + 1}`,
      value: `quantifications[${index}].dismissed`,
    };

    fields.push(quantObj);
  }

  for (let index = 0; index < quantificationsColumnsCount; index++) {
    const quantUserUsernameObj = {
      label: `QUANTIFIER ${index + 1} USERNAME`,
      value: `quantifications[${index}].account.name`,
    };

    fields.push(quantUserUsernameObj);

    const quantUserEthAddressObj = {
      label: `QUANTIFIER ${index + 1} ETH ADDRESS`,
      value: `quantifications[${index}].quantifier.ethereumAddress`,
    };

    fields.push(quantUserEthAddressObj);
  }

  fields.push({
    label: 'AVG SCORE',
    value: 'scoreRealized',
  });

  const json2csv = new Parser({ fields: fields });
  const csv = json2csv.parse(docs);

  res.status(200).contentType('text/csv').attachment('data.csv').send(csv);
};

/**
 * Return period receivers
 *
 * @param {TypedRequestBody<QueryInput>} req
 * @param {Response} res
 * @returns {Promise<void>}
 */
export const exportSummary = async (
  req: TypedRequestBody<QueryInput>,
  res: Response
): Promise<void> => {
  /**
   * TODO: use this url in variable to load transformer
   */
  const customExportMapSetting = (await settingValue(
    'CUSTOM_EXPORT_MAP'
  )) as string;

  const customExportContextSetting = (await settingValue(
    'CUSTOM_EXPORT_CONTEXT'
  )) as string;

  const csSupportPercentageSetting = (await settingValue(
    'CS_SUPPORT_PERCENTAGE'
  )) as number;

  const periodDetailsDto = await findPeriodDetailsDto(req.params.periodId);
  const receivers = await periodReceiverListTransformer(
    periodDetailsDto.receivers
  );

  const fields = [
    {
      label: 'ADDRESS',
      value: 'address',
    },
    {
      label: 'AMOUNT',
      value: 'amount',
    },
    {
      label: 'TOKEN',
      value: 'tokenName',
    },
  ];

  const summarizedReceiverData = getSummarizedReceiverData(
    receivers,
    customExportContextSetting,
    csSupportPercentageSetting
  );

  const json2csv = new Parser({ fields: fields });
  const csv = json2csv.parse(summarizedReceiverData);

  res.status(200).contentType('text/csv').attachment('data.csv').send(csv);
};
