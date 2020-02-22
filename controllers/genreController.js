var Genre = require('../models/genre');
var Book = require('../models/book');
var async = require('async');
var validator = require('express-validator')


exports.genre_list = function(req, res, next) {
    Genre.find().exec(function(err, list_genre) {
        if (err)
            return next(err);
        else
            res.render('genre_list', { title: 'Genre List', genre_list: list_genre });
    });
}

exports.genre_detail = function(req, res) {

    async.parallel( {
        genre: function(callback) {
            Genre.findById(req.params.id).exec(callback);
            },
        genre_books: function(callback) {
            Book.find({ 'genre': req.params.id }).exec(callback);
            }
        },
        function (err, results, next) {
            if (err) {
                return next(err);
            }
            if (results.genre == null) {
                err = new Error('Genre not found!');
                err.status = 404;
                return next(err);
            }
            else {
                res.render('genre_detail', { title: 'Genre Detail', genre: results.genre, 
                    genre_books: results.genre_books });
            }
        }
    );
}

exports.genre_create_get = function(req, res, next) {
    res.render('genre_form', {title: 'Create Genre'});
}

exports.genre_create_post = [

    // validator middleware function
    validator.body('name', 'Genre name required').isLength({ min: 1}).trim(),
    
    // sanitizor middleware function
    validator.sanitizeBody('name').escape(),
    
    // request-handling middleware function
    (req, res, next) => {
        // run and handle validation errors
        const errors = validator.validationResult(req);
        
        var genre = new Genre( {name: req.body.name} );
        
        if (!errors.isEmpty()) {
            res.render('genre_form', {title: 'Create Genre', genre: genre, errors: errors.array()});
            return;
        }
        
        Genre.findOne({ name: req.body.name })
            .exec( function(err, found_genre) {
                if (err)
                    return next(err);
                if (found_genre) {
                    // show genre details if already exists
                    res.redirect(found_genre.url);
                }
                else {
                    // add genre to database and go to corresponding genre details page
                    genre.save(function (err) {
                        if (err)
                            return next(err);
                        else
                            res.redirect(genre.url);
                        });
                }
             });
    }  
];

exports.genre_update_get = function(req, res, next) {
    
    Genre.findById(req.params.id, function(err, genre) {
        if (err)
            return next(err);
        if (genre==null) {
            err = new Error('Genre not found!');
            err.status = 404;
            return next(err);
        }
        res.render('form_genre', {title: 'Update Genre', genre: genre});
    });
}

exports.genre_update_post = [

    validator.body('name', 'Genre name cannot be empty.').isLength({min:1}).trim(),
    validator.sanitizeBody('name').escape(),
    (req, res, next) => {
        const verrs = validator.validationResult(req);
        Genre.findById(req.params.id, function(err, genre) {
            if (err)
                return next(err);
            if (genre==null) {
                err = new Error('Genre not found!');
                err.status = 404;
                return next(err);
            }
            if (!verrs.isEmpty()) {
                res.render('form_genre', {title: 'Update Genre', errors: verrs.array(), genre: genre});
            }
            else {
                genre.name = req.body.name;
                Genre.findByIdAndUpdate(genre._id, genre, {}, function(errs, newGenre) {
                    if (errs)
                        return next(errs);
                    res.redirect('/catalog/genres');
                    });
            }
        });
    }
];


exports.genre_delete_get = function(req, res, next) {
    async.parallel({
            genre:       function(callback) {
                Genre.findById(req.params.id, callback);
                },
            genre_books: function(callback) {
                Book.find({genre: {$elemMatch: {$eq: req.params.id}}}, 'title summary').exec(callback);
                }
        }, function(err, results) {
            if (err)
                return next(err);
            if (results.genre==null) {
                err = new Error('Genre not found!');
                err.status = 404;
                return next(err);
            }
            res.render('genre_delete', {title: 'Delete Genre', genre: results.genre, genre_books: results.genre_books});
        });
};


exports.genre_delete_post = [
    validator.body('genreid', 'Genre ID not specified.').isLength({min:1}).trim(),
    
    validator.sanitizeBody('genreid').escape(),

    (req, res, next) => {
        const verrs = validator.validationResult(req);
        
        if (!verrs.isEmpty()) {
            // cannot delete, show All Genres page
            err = new Error ('Cannot find the specified Genre from database');
            err.status = 404;
            return next(err);
        }
        else {
            // double-check the genre is not assocated with any books again
            async.parallel({
                genre:       function(callback) {
                    Genre.findById(req.params.id, callback);
                },
                genre_books: function(callback) {
                    Book.find({genre: {$elemMatch: {$eq: req.params.id}}}, 'title summary').exec(callback);
                }
            }, function(err, results) {
                if (err)
                    return next(err);
                if (results.genre==null) {
                    err = new Error('Genre not found!');
                    err.status = 404;
                    return next(err);
                }
                if (results.genre_books.length > 0)
                    res.render('genre_delete', {title: 'Delete Genre', genre: results.genre, genre_books: results.genre_books});
                else {
                    Genre.findByIdAndDelete(req.body.genreid, function(err) {
                        if (err)
                            return next(err);
                        res.redirect('/catalog/genres'); // All Genres page
                    });
                }
            });
        }
    }   
];
