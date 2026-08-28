import { useContext } from 'react';

import { TasksContext } from '../stores/TasksContext';
import { TasksContextValue } from '../types';

export const useTasks = (): TasksContextValue => {
  const context = useContext(TasksContext);
  if (context === undefined) {
    throw new Error('useTasks must be used within a TasksProvider');
  }
  return context;
};
