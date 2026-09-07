import { combineReducers } from "redux";
import userReducer from './user';
import notificationsReducer from './notifications';
import appSettingsReducer from './appSettings';

export default combineReducers({
    user: userReducer,
    notifications: notificationsReducer,
    appSettings: appSettingsReducer,
});