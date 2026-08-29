import { Hono } from 'hono';
import { StudentsController } from '../controllers/students.controller.js';

const studentsRoutes = new Hono();

// Specific sub-routes (must be before /:regno)
studentsRoutes.get('/search/:regno', StudentsController.searchStudent);
studentsRoutes.post('/batch-lookup-names', StudentsController.batchLookupNames);
studentsRoutes.post('/recalculate-analytics', StudentsController.recalculateAnalytics);
studentsRoutes.post('/:id/place', StudentsController.placeStudent);

// Collection root
studentsRoutes.get('/', StudentsController.getStudents);

// Parameterized /:regno
studentsRoutes.get('/:regno', StudentsController.getStudentDetails);
studentsRoutes.put('/:regno', StudentsController.updateStudent);

export default studentsRoutes;
