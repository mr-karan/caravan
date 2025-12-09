import { Theme } from '@mui/material/styles';
import { SxProps } from '@mui/system';
import React, { ReactElement } from 'react';
import { useNavBarMode } from '../../lib/themes';
import LogoDark from '../../resources/icon-dark.svg?react';
import LogoLight from '../../resources/icon-light.svg?react';
import LogoWithTextDark from '../../resources/logo-dark.svg?react';
import LogoWithTextLight from '../../resources/logo-light.svg?react';

export interface AppLogoProps {
  /** The size of the logo. 'small' for in mobile view, and 'large' for tablet and desktop sizes. By default the 'large' is used. */
  logoType?: 'small' | 'large';
  /** User selected theme. By default it checks which is is active. */
  themeName?: string;
  /** A class to use on your SVG. */
  className?: string;
  /** SxProps to use on your SVG. */
  sx?: SxProps<Theme>;
  [key: string]: any;
}

export type AppLogoType =
  | React.ComponentType<AppLogoProps>
  | ReactElement
  | typeof React.Component
  | null;

export default function OriginalAppLogo(props: AppLogoProps) {
  const { logoType, themeName } = props;

  const Component =
    logoType === 'large'
      ? themeName === 'dark'
        ? LogoWithTextLight
        : LogoWithTextDark
      : themeName === 'dark'
      ? LogoLight
      : LogoDark;

  return <Component style={{ width: 'auto', height: '32px' }} />;
}

export function AppLogo(props: AppLogoProps) {
  const { logoType = 'large' } = props;
  const mode = useNavBarMode();

  return <OriginalAppLogo logoType={logoType} themeName={mode} />;
}
