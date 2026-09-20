/** Chain after verifyToken. req.user.role comes straight from the signed JWT, so this is as
 * trustworthy as the sign-in that issued it — no extra DB lookup needed. */
module.exports = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'This requires an administrator account.' });
  }
  next();
};
