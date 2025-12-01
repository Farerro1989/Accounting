import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Analytics from './pages/Analytics';
import TelegramSetup from './pages/TelegramSetup';
import UserManagement from './pages/UserManagement';
import DataBackup from './pages/DataBackup';
import SystemSelector from './pages/SystemSelector';
import ExpenseDashboard from './pages/ExpenseDashboard';
import ExpenseList from './pages/ExpenseList';
import ExpenseCategories from './pages/ExpenseCategories';
import ExpenseReports from './pages/ExpenseReports';
import AccountDetail from './pages/AccountDetail';
import TelegramMessages from './pages/TelegramMessages';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Transactions": Transactions,
    "Analytics": Analytics,
    "TelegramSetup": TelegramSetup,
    "UserManagement": UserManagement,
    "DataBackup": DataBackup,
    "SystemSelector": SystemSelector,
    "ExpenseDashboard": ExpenseDashboard,
    "ExpenseList": ExpenseList,
    "ExpenseCategories": ExpenseCategories,
    "ExpenseReports": ExpenseReports,
    "AccountDetail": AccountDetail,
    "TelegramMessages": TelegramMessages,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};