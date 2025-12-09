import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TestContext } from '../../test';
import Loader from './Loader';

describe('Loader Component', () => {
  it('renders with default props and container', () => {
    render(
      <TestContext>
        <Loader title="Loading..." />
      </TestContext>
    );

    // Check if the container Box is present
    const container = screen.getByRole('progressbar').parentElement;
    expect(container).toHaveClass('MuiBox-root');

    // Check if CircularProgress is rendered
    const progress = screen.getByRole('progressbar');
    expect(progress).toHaveClass('MuiCircularProgress-root');
    expect(progress).toHaveAttribute('title', 'Loading...');
  });

  it('renders without container when noContainer is true', () => {
    render(
      <TestContext>
        <Loader title="Loading..." noContainer />
      </TestContext>
    );

    // Check if CircularProgress is rendered directly without container
    const progress = screen.getByRole('progressbar');
    expect(progress).toHaveClass('MuiCircularProgress-root');
    expect(progress.parentElement).not.toHaveClass('MuiBox-root');
  });

  it('renders with custom size', () => {
    const customSize = 80;
    render(
      <TestContext>
        <Loader title="Loading..." size={customSize} />
      </TestContext>
    );

    const progress = screen.getByRole('progressbar');
    expect(progress).toHaveStyle({ width: `${customSize}px`, height: `${customSize}px` });
  });

  it('renders with custom color', () => {
    render(
      <TestContext>
        <Loader title="Loading..." color="secondary" />
      </TestContext>
    );

    const progress = screen.getByRole('progressbar');
    expect(progress).toHaveClass('MuiCircularProgress-colorSecondary');
  });

  it('renders with empty title', () => {
    render(
      <TestContext>
        <Loader title="" />
      </TestContext>
    );

    const progress = screen.getByRole('progressbar');
    expect(progress).toHaveAttribute('title', '');
  });

  it('passes additional props to CircularProgress', () => {
    render(
      <TestContext>
        <Loader title="Loading..." thickness={4} disableShrink />
      </TestContext>
    );

    const progress = screen.getByRole('progressbar');
    expect(progress).toHaveClass('MuiCircularProgress-root');
    expect(progress).toHaveAttribute('role', 'progressbar');
    expect(progress).toHaveAttribute('title', 'Loading...');
  });
});
