import * as customerController from './controllers/customerController.js';
import * as productController from './controllers/productController.js';
import * as holidayController from './controllers/holidayController.js';
import * as ruleController from './controllers/ruleController.js';
import * as settingController from './controllers/settingController.js';
import * as messageController from './controllers/messageController.js';
import * as analyticsController from './controllers/analyticsController.js';
import * as systemController from './controllers/systemController.js';
import * as whatsappController from './controllers/whatsappController.js';
import * as employeeController from './controllers/employeeController.js';
import * as webhookController from './controllers/webhookController.js';
import * as notificationController from './controllers/notificationController.js';

console.log('=== VERIFYING CONTROLLER EXPORTS IN api.js ===\n');

const checks = [
  // Employees
  ['employeeController.getEmployees', employeeController.getEmployees],
  ['employeeController.createEmployee', employeeController.createEmployee],
  ['employeeController.updateEmployee', employeeController.updateEmployee],
  ['employeeController.updateEmployeeStatus', employeeController.updateEmployeeStatus],
  ['employeeController.deleteEmployee', employeeController.deleteEmployee],
  ['employeeController.getActiveBDEs', employeeController.getActiveBDEs],

  // Customers
  ['customerController.getCustomers', customerController.getCustomers],
  ['customerController.getTestDataPreview', customerController.getTestDataPreview],
  ['customerController.cleanupTestData', customerController.cleanupTestData],
  ['customerController.getCustomerById', customerController.getCustomerById],
  ['customerController.createCustomer', customerController.createCustomer],
  ['customerController.updateCustomer', customerController.updateCustomer],
  ['customerController.assignBDE', customerController.assignBDE],
  ['customerController.deleteCustomer', customerController.deleteCustomer],

  // Products
  ['productController.getProducts', productController.getProducts],
  ['productController.exportProductsCSV', productController.exportProductsCSV],
  ['productController.previewImportCSV', productController.previewImportCSV],
  ['productController.importProductsCSV', productController.importProductsCSV],
  ['productController.getProductById', productController.getProductById],
  ['productController.createProduct', productController.createProduct],
  ['productController.updateProduct', productController.updateProduct],
  ['productController.deleteProduct', productController.deleteProduct],

  // System
  ['systemController.getSystemStatus', systemController.getSystemStatus],
  ['systemController.getHealthDetails', systemController.getHealthDetails],
  ['systemController.changePassword', systemController.changePassword],
  ['systemController.getSidebarStats', systemController.getSidebarStats],

  // Messages & WhatsApp
  ['messageController.getConversations', messageController.getConversations],
  ['messageController.getMessages', messageController.getMessages],
  ['messageController.sendMessage', messageController.sendMessage],
  ['messageController.getApprovedTemplates', messageController.getApprovedTemplates],
  ['messageController.sendTemplateMessage', messageController.sendTemplateMessage],
  ['messageController.toggleTakeover', messageController.toggleTakeover],

  // Notifications
  ['notificationController.getHandoverNotifications', notificationController.getHandoverNotifications],
  ['notificationController.dismissHandoverNotification', notificationController.dismissHandoverNotification],
  ['notificationController.dismissTokenAlert', notificationController.dismissTokenAlert],
  ['notificationController.getAlertNumber', notificationController.getAlertNumber],
  ['notificationController.updateAlertNumber', notificationController.updateAlertNumber],

  // WhatsApp Config
  ['whatsappController.getConfig', whatsappController.getConfig],
  ['whatsappController.addConfig', whatsappController.addConfig],
  ['whatsappController.updateConfig', whatsappController.updateConfig],
  ['whatsappController.deleteConfig', whatsappController.deleteConfig],
  ['whatsappController.toggleBotStatus', whatsappController.toggleBotStatus],
  ['whatsappController.setDefaultConnection', whatsappController.setDefaultConnection],
  ['whatsappController.testConnection', whatsappController.testConnection],
];

let allExist = true;
for (const [name, fn] of checks) {
  if (typeof fn === 'function') {
    console.log(`✓ ${name} is valid function`);
  } else {
    console.error(`✗ ${name} is MISSING or NOT a function (type: ${typeof fn})`);
    allExist = false;
  }
}

if (!allExist) {
  console.error('\nFAILED: Some controller functions referenced in api.js are missing!');
  process.exit(1);
} else {
  console.log(`\nALL ${checks.length} CONTROLLER FUNCTIONS VERIFIED SUCCESSFULLY!`);
}
