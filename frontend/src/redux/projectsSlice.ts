import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import type { ReactNode } from 'react';
import type { ButtonStyle } from '../components/common/ActionButton/ActionButton';

export interface ProjectDefinition {
  id: string;
  namespaces: string[];
  clusters: string[];
}

/** Define custom way to create new Projects */
export interface CustomCreateProject {
  id: string;
  name: string;
  description: string;
  icon: string | (() => ReactNode);
  component: ({
    onBack,
  }: {
    /** Callback for going to the previous screen */
    onBack: () => void;
  }) => ReactNode;
}

/**
 * Custom section for the project overview tab
 */
export interface ProjectOverviewSection {
  id: string;
  component: (props: { project: ProjectDefinition; projectResources: any[] }) => ReactNode;
}

export interface ProjectDetailsTab {
  id: string;
  label?: ReactNode;
  icon: string | ReactNode;
  component?: (props: { project: ProjectDefinition; projectResources: any[] }) => ReactNode;
  /** Function to check if this tab be displayed in the given project. If not provided the Tab will be enabled. */
  isEnabled?: ({ project }: { project: ProjectDefinition }) => Promise<boolean>;
}

export interface ProjectDeleteButton {
  isEnabled?: (params: { project: ProjectDefinition }) => Promise<boolean>;
  component: (props: { project: ProjectDefinition; buttonStyle?: ButtonStyle }) => ReactNode;
}

export interface ProjectsState {
  customCreateProject: Record<string, CustomCreateProject>;
  overviewSections: Record<string, ProjectOverviewSection>;
  detailsTabs: Record<string, ProjectDetailsTab>;
  projectDeleteButton?: ProjectDeleteButton;
}

const initialState: ProjectsState = {
  customCreateProject: {},
  detailsTabs: {},
  overviewSections: {},
};

const projectsSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {
    /** Register custom project create popup, for plugins */
    addCustomCreateProject(state, action: PayloadAction<CustomCreateProject>) {
      state.customCreateProject[action.payload.id] = action.payload;
    },

    /** Register additional tab for project details page */
    addDetailsTab(state, action: PayloadAction<ProjectDetailsTab>) {
      state.detailsTabs[action.payload.id] = action.payload;
    },

    /** Register additional section to the overview page */
    addOverviewSection(state, action: PayloadAction<ProjectOverviewSection>) {
      state.overviewSections[action.payload.id] = action.payload;
    },

    /** Override default delete button */
    setProjectDeleteButton(state, action: PayloadAction<ProjectDeleteButton>) {
      state.projectDeleteButton = action.payload;
    },
  },
});

export const { addCustomCreateProject, addDetailsTab, addOverviewSection, setProjectDeleteButton } =
  projectsSlice.actions;

export default projectsSlice.reducer;
