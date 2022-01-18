import * as periodController from '@controllers/periods';
import { Router } from 'express';

// Period-routes
const periodRouter = Router();
periodRouter.post('/create', periodController.create);
periodRouter.patch('/:periodId/update', periodController.update);
periodRouter.patch('/:periodId/close', periodController.close);
periodRouter.get(
  '/:periodId/verifyQuantifierPoolSize',
  periodController.verifyQuantifierPoolSize
);
periodRouter.patch(
  '/:periodId/assignQuantifiers',
  periodController.assignQuantifiers
);
export default periodRouter;
