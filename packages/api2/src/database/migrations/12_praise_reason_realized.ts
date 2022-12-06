import { model } from 'mongoose';
import { PraiseSchema } from '../schemas/praise/praise.schema';

const up = async (): Promise<void> => {
  const PraiseModel = model('Praise', PraiseSchema);
  const praises = await PraiseModel.find({
    reasonRealized: { $exists: false },
  });

  if (praises.length === 0) return;

  const updates = praises.map((s) => ({
    updateOne: {
      filter: { _id: s._id },
      update: { $set: { reasonRealized: s.reason } },
    },
  })) as any;

  await PraiseModel.bulkWrite(updates);
};

const down = async (): Promise<void> => {
  const PraiseModel = model('Praise', PraiseSchema);
  await PraiseModel.updateMany(
    {
      reasonRealized: { $exists: true },
    },
    {
      $unset: { reasonRealized: 1 },
    },
  );
};

export { up, down };
