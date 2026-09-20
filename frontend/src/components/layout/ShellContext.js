import { createContext, useContext } from 'react';

// True for any page shown under the app bar. Such a page has the bar's wordmark and Apps menu for
// getting around, so it doesn't need a "back to the dashboard" button of its own.
const ShellContext = createContext(false);

export const ShellProvider = ShellContext.Provider;

export const useInShell = () => useContext(ShellContext);
