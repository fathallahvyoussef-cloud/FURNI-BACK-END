const jwt = require('jsonwebtoken');


const isAdmin = (req, res, next) => {

  const header = req.headers.authorization;
  if(!header){
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const secret = 'MY_SECRET_KEY';


  const authHeader = req.get('authorization');
  const token = authHeader.split(' ')[1]
  const decoded = jwt.verify(token, secret);
  req.user = decoded 
  
  if (req.user?.role !== 'admin' || !req.user) {
    
    return res.status(403).json({ message: 'Forbidden: Admins only' });
  }
  next();
};

module.exports = isAdmin;