import { createContext } from 'react';
import { FuseSettingsConfigType } from '@fuse/core/FuseSettings/FuseSettingsTypes';

type FuseLayoutSettingsContextType = FuseSettingsConfigType['layout'];

const FuseLayoutSettingsContext = createContext<FuseLayoutSettingsContextType | undefined>(undefined);

export default FuseLayoutSettingsContext;
