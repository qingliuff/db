const mongoose = require("mongoose");
const Review = require("./review");
const Schema = mongoose.Schema;

const MoviesSchema = new Schema({
    title: String,
    director : String,
    stars : String,
    year : Number,
    img : [
        {
            url: String,
            filename: String
        }
    ],
    rating : Number,
    description : String,
    author: {
        type : Schema.Types.ObjectId,
        ref : "User"
    },
    authorName: String,
    reviews : [
        {
            type : Schema.Types.ObjectId,
            ref : 'Review'
        }
    ]
});
MoviesSchema.post('findOneAndDelete', async function(doc){
    if(doc){
        await Review.deleteMany({
            _id:{
                $in : doc.reviews
            }
        })
    }
})

module.exports = mongoose.model("Movie",MoviesSchema);
