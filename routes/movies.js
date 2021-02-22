const express = require("express");
const router = express.Router();
const catchAsync = require("../utils/catchAsync.js");
const ExpressError = require("../utils/ExpressError.js");
const Movie = require('../models/movie.js');
const multer = require("multer");
const {storage} = require("../cloudinary");
const upload = multer({storage});
const {cloudinary} = require("../cloudinary");
const Joi = require('joi');

const {isLoggedIn} = require("../middleware");
const validateMovie = (req,res,next) => {
    const movieSchema = Joi.object({
        movie : Joi.object({
            title:Joi.string().required(),
            director:Joi.string().required(),
            stars:Joi.string().required(),
            year:Joi.number().required(),
            rating:Joi.number().required(),
            description:Joi.string().required()
        }).required(),
        deleteImages:Joi.array()
    })
    const result = movieSchema.validate(req.body);
    if(result.error){
        throw ExpressError(result.error.details,400);
    }else{
        next();
    }
}
const isAuthor = async(req,res,next) => {
    const {id} = req.params;
    const movie = await Movie.findById(id);
    if(!movie.author){
        // req.flash("error","Sorry, you don't have the permission");
        return res.redirect("/movies/${id}");
    }
    if(!movie.author.equals(req.user._id)){
        // req.flash("error","Sorry, you don't have the permission");
        return res.redirect("/movies/${id}");
    }
    next();
}
router.route('/').post(upload.array('image'),validateMovie);
//Show all movies.
router.get("/",catchAsync(async (req,res) => {
    const movies = await Movie.find({});
    res.render("movies/index.ejs",{movies});
}));
router.get('/new', isLoggedIn, (req, res) => {
    res.render("movies/new.ejs");
})
router.post('/', isLoggedIn,catchAsync(async (req,res,next) => {
    // if(!req.body.movie) throw new ExpressError("Invalid Movie Information",400);  
    const movie = new Movie(req.body.movie);
    movie.img = req.files.map(f => ({
        url : f.path,
        filename : f.filename
    }));
    movie.author = req.user._id;
    movie.authorName = req.user.username;
    console.log(movie);
    await movie.save();
    req.flash("success","Post successfully!");
    res.redirect(`/movies/${movie._id}`);
}));

router.get('/:id',catchAsync(async (req, res) => {
    try{
        const movie = await (await Movie.findById(req.params.id).populate('reviews')).populate("author");
        res.render('movies/show', { movie});
    }catch(e){
        req.flash("error","Sorry page not found!");
        res.redirect("/movies");
    }
}));

router.get('/:id/edit',isLoggedIn,isAuthor,catchAsync(async (req, res) => {
    const movie = await Movie.findById(req.params.id)
    res.render('movies/edit', { movie });
}));
router.put('/:id', isLoggedIn, isAuthor,upload.array('image'),validateMovie,catchAsync(async (req, res) => {
    const { id } = req.params;
    const movie = await Movie.findByIdAndUpdate(id, { ...req.body.movie });
    const imgs = req.files.map(f => ({
        url : f.path,
        filename : f.filename
    }));
    movie.img.push(...imgs);
    if(req.body.deleteImages){
        for(let filename of req.body.deleteImages){
            await cloudinary.uploader.destroy(filename);
        }
        await movie.updateOne({$pull:{ img:{ filename:{ $in:req.body.deleteImages } }}});
    }

    await movie.save();
    req.flash("success","Successfully updated!");
    res.redirect(`/movies/${movie._id}`)
}));
router.delete('/:id',isLoggedIn, isAuthor,catchAsync(async (req, res) => {
    const { id } = req.params;
    const movie = await Movie.findById(req.params.id);
    for(let img of movie.img){
        await cloudinary.uploader.destroy(img.filename);
    }
    await Movie.findByIdAndDelete(id);
    req.flash("success","Deleted!");
    res.redirect('/movies');
}));


module.exports = router;