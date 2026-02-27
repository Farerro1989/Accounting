/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AIReport from './pages/AIReport';
import AccountDetail from './pages/AccountDetail';
import Analytics from './pages/Analytics';
import Dashboard from './pages/Dashboard';
import DataBackup from './pages/DataBackup';
import ExpenseCategories from './pages/ExpenseCategories';
import ExpenseDashboard from './pages/ExpenseDashboard';
import ExpenseList from './pages/ExpenseList';
import ExpenseReports from './pages/ExpenseReports';
import Home from './pages/Home';
import ProfitDetails from './pages/ProfitDetails';
import SystemSelector from './pages/SystemSelector';
import TelegramMessages from './pages/TelegramMessages';
import TelegramSetup from './pages/TelegramSetup';
import Transactions from './pages/Transactions';
import UserManagement from './pages/UserManagement';
import ReadOnlyView from './pages/ReadOnlyView';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AIReport": AIReport,
    "AccountDetail": AccountDetail,
    "Analytics": Analytics,
    "Dashboard": Dashboard,
    "DataBackup": DataBackup,
    "ExpenseCategories": ExpenseCategories,
    "ExpenseDashboard": ExpenseDashboard,
    "ExpenseList": ExpenseList,
    "ExpenseReports": ExpenseReports,
    "Home": Home,
    "ProfitDetails": ProfitDetails,
    "SystemSelector": SystemSelector,
    "TelegramMessages": TelegramMessages,
    "TelegramSetup": TelegramSetup,
    "Transactions": Transactions,
    "UserManagement": UserManagement,
    "ReadOnlyView": ReadOnlyView,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};