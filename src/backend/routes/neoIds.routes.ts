import { Hono } from 'hono';
import { NeoIdsController } from '../controllers/neoIds.controller.js';

const neoIdsRoutes = new Hono();

neoIdsRoutes.get('/', NeoIdsController.getAll);
neoIdsRoutes.get('/search/:neoid', NeoIdsController.search);
neoIdsRoutes.post('/batch-lookup', NeoIdsController.batchLookup);
neoIdsRoutes.post('/batch-map-regno', NeoIdsController.batchMapRegno);
neoIdsRoutes.post('/batch-set-campus', NeoIdsController.batchSetCampus);

export default neoIdsRoutes;
