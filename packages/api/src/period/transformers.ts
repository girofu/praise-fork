import { quantificationListTransformer } from '@/praise/transformers';
import { Quantification, QuantificationDto } from '@/praise/types';
import { UserModel } from '@/user/entities';
import { userAccountTransformer } from '@/useraccount/transformers';
import {
  PeriodDetailsGiverReceiver,
  PeriodDetailsGiverReceiverDto,
  PeriodDocument,
  PeriodDetailsDto,
} from './types';

/**
 * Serialize a PeriodDocument
 *
 * @param {PeriodDocument} periodDocument
 * @returns {PeriodDetailsDto}
 */
export const periodTransformer = (
  periodDocument: PeriodDocument
): PeriodDetailsDto => {
  const { _id, name, status, endDate, createdAt, updatedAt } = periodDocument;
  return {
    _id,
    name,
    status,
    endDate: endDate.toISOString(),
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
};

/**
 * Serialize a list of Praise.quantification lists
 *
 * @param {(Quantification[][] | undefined)} listOfQuantificationLists
 * @returns {Promise<Array<Array<QuantificationDto>>>}
 */
const listOfQuantificationListsTransformer = async (
  listOfQuantificationLists: Quantification[][] | undefined
): Promise<Array<Array<QuantificationDto>>> => {
  if (listOfQuantificationLists && Array.isArray(listOfQuantificationLists)) {
    const quantifications: QuantificationDto[][] = [];
    for (const q of listOfQuantificationLists) {
      quantifications.push(await quantificationListTransformer(q));
    }
    return quantifications;
  }
  return [];
};

/**
 * Serialize relevant details about a Praise giver/receiver in a period
 *
 * @param {PeriodDetailsGiverReceiver} gr
 * @returns {Promise<PeriodDetailsGiverReceiverDto>}
 */
const periodDetailsGiverReceiverToDto = async (
  gr: PeriodDetailsGiverReceiver
): Promise<PeriodDetailsGiverReceiverDto> => {
  const { _id, praiseCount, quantifications, scoreRealized, userAccounts } = gr;
  return {
    _id: _id.toString(),
    praiseCount,
    quantifications: await listOfQuantificationListsTransformer(
      quantifications
    ),
    scoreRealized,
    userAccount:
      Array.isArray(userAccounts) && userAccounts.length > 0
        ? userAccountTransformer(userAccounts[0])
        : undefined,
  };
};

/**
 * Serialize relevant details about a list of Praise givers/receivers in a period
 *
 * @param {(PeriodDetailsGiverReceiver[] | undefined)} periodDetailsGiverReceiverList
 * @returns {Promise<PeriodDetailsGiverReceiverDto[]>}
 */
export const periodDetailsGiverReceiverListTransformer = async (
  periodDetailsGiverReceiverList: PeriodDetailsGiverReceiver[] | undefined
): Promise<PeriodDetailsGiverReceiverDto[]> => {
  if (
    periodDetailsGiverReceiverList &&
    Array.isArray(periodDetailsGiverReceiverList)
  ) {
    const grDto: PeriodDetailsGiverReceiverDto[] = [];
    for (const pdr of periodDetailsGiverReceiverList) {
      grDto.push(await periodDetailsGiverReceiverToDto(pdr));
    }
    return grDto;
  }
  return [];
};

/**
 * Serialize relevant details about a Praise receiver in a period
 *
 * @param {PeriodDetailsReceiver} periodReceiver
 * @returns {Promise<PeriodDetailsReceiverDto>}
 */
const periodReceiverToDto = async (
  periodReceiver: PeriodDetailsGiverReceiverDto
): Promise<PeriodDetailsGiverReceiverDto> => {
  const { _id, praiseCount, scoreRealized, userAccount } = periodReceiver;
  let ethereumAddress = undefined;

  if (userAccount) {
    const receiver = await UserModel.findById(userAccount.user);
    ethereumAddress = receiver?.ethereumAddress;
  }

  return {
    _id: _id.toString(),
    praiseCount,
    ethereumAddress,
    scoreRealized,
    userAccount,
  };
};

/**
 * Serialize relevant details about a list of Praise receivers in a period (with ETH address)
 *
 * @param {(PeriodReceiver[] | undefined)} periodReceiverList
 * @returns {Promise<PeriodReceiverDto[]>}
 */
export const periodReceiverListTransformer = async (
  periodReceiverList: PeriodDetailsGiverReceiverDto[] | undefined
): Promise<PeriodDetailsGiverReceiverDto[]> => {
  if (periodReceiverList && Array.isArray(periodReceiverList)) {
    const periodReceiverDto: PeriodDetailsGiverReceiverDto[] = [];
    for (const pdr of periodReceiverList) {
      periodReceiverDto.push(await periodReceiverToDto(pdr));
    }
    return periodReceiverDto;
  }
  return [];
};
