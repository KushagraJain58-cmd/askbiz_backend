let express = require("express");
let authRouter = require("./auth");
let adminRouter = require("./admin");
let userRouter = require("./user");

let router = express.Router();

router.use('/auth', authRouter);
router.use('/admin', adminRouter);
router.use('/user', userRouter);


module.exports = router;


