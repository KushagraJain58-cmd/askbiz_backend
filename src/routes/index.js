let express = require("express");
let authRouter = require("./auth");
let adminRouter = require("./admin");
let userRouter = require("./user");
let aiRouter = require("./ai");

let router = express.Router();

router.use('/auth', authRouter);
router.use('/admin', adminRouter);
router.use('/user', userRouter);
router.use('/ai', aiRouter);


module.exports = router;


