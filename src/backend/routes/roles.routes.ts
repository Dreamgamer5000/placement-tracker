import { Hono } from 'hono';
import { RolesController } from '../controllers/roles.controller.js';

const rolesRoutes = new Hono();

rolesRoutes.get('/', RolesController.getRoles);
rolesRoutes.post('/', RolesController.createRole);

export default rolesRoutes;
