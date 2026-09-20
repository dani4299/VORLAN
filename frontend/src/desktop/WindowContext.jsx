import { createContext, useContext } from 'react';

// Provided to whatever renders inside a desktop window, so an app can tell it's hosted in one
// (and hide its own "back to dashboard" affordance) and can close its own window.
const WindowContext = createContext(null);

export const WindowProvider = WindowContext.Provider;

/** { appId, close } inside a desktop window, or null when the page is rendered on its own route. */
export const useWindow = () => useContext(WindowContext);
