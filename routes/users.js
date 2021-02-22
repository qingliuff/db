const express = require('express');
const router = express.Router();
const User = require("../models/user");
const catchAsync = require("../utils/catchAsync");
const passport = require("passport");
router.get("/register",(req,res) =>{
    res.render("users/register");
})

router.post('/register',catchAsync(async (req,res,next) =>{
    try{
        const {email,username,password} = req.body;
        const user = new User({email,username});
        const registeredUser = await User.register(user,password);
        req.login(registeredUser,err => {
            if(err){
                return next(err);
            }else{
                req.flash('success',"Welcome!");
                res.redirect("/movies");
            }
        })
       
    }catch(e){
        req.flash('error',e.message);
        res.redirect('/register');
    }
}));
router.get("/login",(req,res) => {
    res.render("users/login");
});
router.post("/login",passport.authenticate("local",{failureFlash : true,failureRedirect : '/login'}),(req,res) => {
    req.flash('success',"Welcome Back!" + " " + req.user.username);
    res.redirect("/movies");
});
router.get("/logout",(req,res) => {
    req.logout();
    req.flash('success',"Good Bye!");
    res.redirect("/movies");
})
module.exports = router;