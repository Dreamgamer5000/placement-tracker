import { Hono } from 'hono';
import { PredictController } from '../controllers/predict.controller.js';

const predictRoutes = new Hono();

predictRoutes.post('/', PredictController.predictCompanies);

export default predictRoutes;
