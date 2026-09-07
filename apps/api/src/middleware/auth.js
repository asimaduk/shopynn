import jwt from 'jsonwebtoken';

const auth = (req, res, next) => {
    const token = req.header('Authorization')?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access denied. No token.' });

    try {
        const decode = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decode;

        if(req.body) {
            req.body.creator_id = decode.id;
            req.body.tenant_id = decode.tenant_id;

            if(decode.user_type != 1) {
                req.body.warehouse_id = decode.warehouse_id;
            }
        }
        next();
    } catch (error) {
        res.status(400).json({ error: 'Invalid Token' });
    }
};

export default auth;