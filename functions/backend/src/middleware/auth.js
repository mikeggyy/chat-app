import { auth } from '../services/firebaseAdmin.js';

export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Missing authorization token' });
    }

    const token = authHeader.slice('Bearer '.length);
    const decoded = await auth.verifyIdToken(token);

    req.user = {
      uid: decoded.uid,
      claims: decoded,
    };

    return next();
  } catch (error) {
    return next(error);
  }
}
