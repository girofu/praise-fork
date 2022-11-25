import { ServiceException } from '@/shared/service-exception';
import { UtilsProvider } from '@/utils/utils.provider';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Request } from 'express';
import { Model, Types } from 'mongoose';
import { PeriodDocument } from 'src/periods/schemas/periods.schema';
import { PeriodStatusType } from '../../../api/src/period/types';
import {
  PeriodSettings,
  PeriodSettingsDocument,
} from './schemas/periodsettings.schema';
import { SetPeriodSettingDto } from './dto/set-periodsetting.dto';

@Injectable()
export class PeriodSettingsService {
  constructor(
    @InjectModel(PeriodSettings.name)
    private periodSettingsModel: Model<PeriodSettingsDocument>,
    private periodModel: Model<PeriodDocument>,
    private utils: UtilsProvider,
  ) {}

  async findAll(periodId: Types.ObjectId): Promise<PeriodSettings[]> {
    const period = await this.periodModel.findById(periodId);
    if (!period) throw new ServiceException('Period not found.');

    const settings = await this.periodSettingsModel
      .find({ period: period._id })
      .lean();
    return settings.map((setting) => new PeriodSettings(setting));
  }

  async findOneById(
    settingId: Types.ObjectId,
    periodId: Types.ObjectId,
  ): Promise<PeriodSettings> {
    const period = await this.periodModel.findById(periodId);
    if (!period) throw new ServiceException('Period not found.');

    const periodSetting = await this.periodSettingsModel
      .findOne({ id: settingId, period: periodId })
      .lean();

    if (!periodSetting) throw new ServiceException('periodSettings not found.');
    return new PeriodSettings(periodSetting);
  }

  async setOne(
    settingId: Types.ObjectId,
    periodId: Types.ObjectId,
    req: Request,
    data: SetPeriodSettingDto,
  ): Promise<PeriodSettings> {
    const period = await this.periodModel.findById(periodId);
    if (!period) throw new ServiceException('Period not found');
    if (period.status !== PeriodStatusType.OPEN)
      throw new ServiceException(
        'Period settings can only be changed when period status is OPEN.',
      );

    const periodSetting = await this.periodSettingsModel.findOne({
      _id: settingId,
      period: periodId,
    });
    if (!periodSetting) throw new ServiceException('PeriodSettings not found.');

    const originalValue = periodSetting.value;
    if (periodSetting.type === 'Image') {
      const uploadResponse = await this.utils.upload(req, 'value');
      if (uploadResponse) {
        periodSetting.value &&
          (await this.utils.removeFile(periodSetting.value));
        periodSetting.value = uploadResponse;
      }
    } else {
      if (typeof data.value === 'undefined') {
        throw new ServiceException('Value is required field');
      }
      periodSetting.value = data.value;
    }

    // await logEvent(
    //   EventLogTypeKey.SETTING,
    //   `Updated global setting "${setting.label}" from "${
    //     originalValue || ''
    //   }" to "${setting.value || ''}"`,
    //   {
    //     userId: res.locals.currentUser._id,
    //   },
    // );

    await periodSetting.save();
    return this.findOneById(settingId, periodId);
  }
}
