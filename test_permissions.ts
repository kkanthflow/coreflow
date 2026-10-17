import { hasPermission } from "./web/src/lib/permissions.js";
console.log("hasPermission('freelancer', 'view_projects'):", hasPermission('freelancer', 'view_projects'));
console.log("hasPermission('freelancer', 'manage_tasks'):", hasPermission('freelancer', 'manage_tasks'));
