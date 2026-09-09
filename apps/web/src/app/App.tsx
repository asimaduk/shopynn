'use client';

import { SnackbarProvider } from 'notistack';
import { useMemo } from 'react';
// import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFnsV3';
// import { enUS } from 'date-fns/locale/en-US';
import { LocalizationProvider } from '@mui/x-date-pickers-pro/LocalizationProvider';
import { Provider } from 'react-redux';
import ErrorBoundary from '@fuse/utils/ErrorBoundary';
import AppContext from 'src/contexts/AppContext';
import { Toaster } from 'react-hot-toast';
import { PersistGate } from 'redux-persist/integration/react';
import { AdapterDayjs } from '@mui/x-date-pickers-pro/AdapterDayjs';

import { FuseSettingsProvider } from '@fuse/core/FuseSettings/FuseSettingsProvider';
import { I18nProvider } from '@i18n/I18nProvider';
import store from '../store/store';
import MainThemeProvider from '../contexts/MainThemeProvider';
import FuseMessage from '@fuse/core/FuseMessage/FuseMessage';
import AuthTransitionOverlay from '../components/AuthTransitionOverlay';
import InactivityLogout from '../components/InactivityLogout';

type AppProps = {
	children?: React.ReactNode;
};

/**
 * The main App component.
 */
function App(props: AppProps) {
	const { children } = props;
	const val = useMemo(() => ({}), []);

	return (
		<ErrorBoundary>
			<AppContext.Provider value={val}>
				{/* Date Picker Localization Provider */}
				<LocalizationProvider
					// dateAdapter={AdapterDateFns}
					dateAdapter={AdapterDayjs}
					// adapterLocale={enUS}
				>
					{/* Redux Store Provider */}
					<Provider store={store.store}>
						<PersistGate loading={null} persistor={store.persistor}>
							<FuseSettingsProvider>
								<I18nProvider>
									{/* Theme Provider */}
									<MainThemeProvider>

										{/* Notistack Notification Provider */}
										<SnackbarProvider
											maxSnack={5}
											anchorOrigin={{
												vertical: 'bottom',
												horizontal: 'right'
											}}
											classes={{
												containerRoot: 'bottom-0 right-0 mb-13 md:mb-17 mr-2 lg:mr-20 z-99'
											}}
										>
											{children}
											<InactivityLogout />
											<AuthTransitionOverlay />
											<FuseMessage />
											<Toaster
												position="top-center"
												reverseOrder={false}
												gutter={8}
												containerClassName=""
												containerStyle={{top:90}}
												toastOptions={{
													// Define default options
													className: '',
													duration: 5000,
													removeDelay: 1000,
													style: {
														background: '#fff',
														color: '#363636',
													},

													// Default options for specific types
													success: {
														duration: 4000,
														style: {
															backgroundColor:'green',
															color:'white'
														},
														iconTheme: {
															primary: 'white',
															secondary: 'green',
														},
													},
													error: {
														duration: 4000,
														style: {
															backgroundColor:'red',
															color:'white'
														},
														iconTheme: {
															primary: 'white',
															secondary: 'red',
														}
													}
												}}
											/>
										</SnackbarProvider>
									</MainThemeProvider>
								</I18nProvider>
							</FuseSettingsProvider>
						</PersistGate>
					</Provider>
				</LocalizationProvider>
			</AppContext.Provider>
		</ErrorBoundary>
	);
}

export default App;
