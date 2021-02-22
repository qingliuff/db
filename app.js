if(process.env.NODE_ENV !== "production"){
    require("dotenv").config();
}

const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const methodOverride = require('method-override');
const Movie = require('./models/movie.js');
const ejsMate = require("ejs-mate");
const catchAsync = require("./utils/catchAsync.js");
const ExpressError = require("./utils/ExpressError.js");
const Joi = require('joi');
const Review = require("./models/review");
const { PassThrough } = require('stream');
const passport = require("passport");
const LocalStrategy = require("passport-local");
const session = require("express-session");
const MongoDBStore = require("connect-mongo")(session);
const flash = require("connect-flash");
const User = require("./models/user");
const { authenticate } = require('passport');
const {isLoggedIn} = require("./middleware");
const dbUrl = process.env.DB_URL || 'mongodb://localhost:27017/QMDb';


const moviesRoutes = require("./routes/movies");
const userRoutes = require("./routes/users");
const review = require('./models/review');
// 'mongodb://localhost:27017/QMDb'dbUrl

mongoose.connect(dbUrl, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
    console.log("Database connected");
});

const app = express();

app.engine("ejs",ejsMate);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'))

app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
const secret = process.env.SECRET || "thisshouldbeabettersecret!" ;
const store = new MongoDBStore({
    url: dbUrl,
    secret:secret,
    touchAfter : 24 * 60 * 60
});

const sessionConfig = {
    store,
    name : "session",
    secret,
    resave : false,
    saveUninitialized: true,
    cookie :{
        httpOnly : true,
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
        maxAge : 1000 * 60 * 60 * 24 * 7
    }
}
app.use(session(sessionConfig));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

const validateReview = (req,res,next) => {
    reviewSchema = Joi.object({
        review:Joi.object({
            rating : Joi.number().required(),
            body :Joi.string().required()
        }).required()
    })
    const result = reviewSchema.validate(req.body);
    if(result.error){
        throw ExpressError(result.error.details,400);
    }else{
        next();
    }
}
app.use((req,res,next) => {
    res.locals.currentUser = req.user;
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    next();
})

app.use("/movies",moviesRoutes);
app.use("/",userRoutes);

app.get("/",(req,res) =>{
    res.render("home.ejs");
});

app.post("/movies/:id/reviews",isLoggedIn,validateReview,catchAsync(async(req,res) => {
    const movie = await Movie.findById(req.params.id);
    const review = new Review(req.body.review);
    review.author = req.user;
    review.authorName = req.user.username;
    movie.reviews.push(review);
    await review.save();
    await movie.save();
    req.flash("success","Posted!");
    res.redirect(`/movies/${movie._id}`);
}));

app.delete('/movies/:id/reviews/:reviewId',isLoggedIn,catchAsync(async(req,res) => {
    const {id,reviewId} = req.params;
    const review = await Review.findById(reviewId);
    if(!review.author._id.equals(req.user._id)){
        req.flash("error","You don't have the permission!");
        return res.redirect(`/movies/${id}`);
    }
    if(!review.author){
        req.flash("error","You don't have the permission!");
        return res.redirect(`/movies/${id}`);
    }
    await Movie.findByIdAndUpdate(id,{$pull:{reviews:reviewId}});
    await Review.findByIdAndDelete(reviewId);
    req.flash("success","Deleted!");
    res.redirect(`/movies/${id}`);
}));

//Only run when all routes will not match! Order is important!
app.all('*',(req,res,next) =>{
    next(new ExpressError("Page Not Found",404));
})
app.use((err,req,res,next) =>{
    const {statusCode = 500} = err;
    res.status(statusCode).render("error.ejs",{err});
})

app.listen(3000, () => {
    console.log('Serving on port 3000');
})
