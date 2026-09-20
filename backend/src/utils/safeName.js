const path = require('path');

/**
 * True only for a plain file name: no folders, no "..", nothing that could point outside the folder it
 * is about to be joined to. A name taken from a URL must pass this before it is ever used in a path.
 */
const isSafeFileName = (name) => typeof name === 'string'
  && name.length > 0
  && name.length <= 255
  && name === path.basename(name)
  && !/[\0\\/]/.test(name)
  && name !== '.'
  && name !== '..';

/**
 * Usernames end up in file names (a personal file is `username_file`), so they can't contain anything
 * that means "folder" or that some filesystem forbids. Returns a message for the person, or null if fine.
 */
const usernameProblem = (username) => {
  if (typeof username !== 'string' || !username.trim()) return 'Enter a username.';
  if (username.length > 64) return 'The username can be at most 64 characters.';
  if (/[\\/:*?"<>|\0-\x1f]/.test(username)) return 'The username can\'t contain / \\ : * ? " < > | or control characters.';
  if (username.startsWith('.')) return 'The username can\'t start with a dot.';
  return null;
};

module.exports = { isSafeFileName, usernameProblem };
