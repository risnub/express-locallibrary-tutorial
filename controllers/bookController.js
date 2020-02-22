var Book = require('../models/book');
var Author = require('../models/author');
var Genre = require('../models/genre');
var BookInstance = require('../models/bookinstance');

var async = require('async');
var validator = require('express-validator');

exports.index = function(req, res) {
    
    async.parallel(
        {
            book_count: function(callback) {
                Book.countDocuments({}, callback);
            },
            book_instance_count: function(callback) {
                BookInstance.countDocuments({}, callback);
            },
            book_instance_avail_count: function(callback) {
                BookInstance.countDocuments({status:'Available'}, callback);
            },
            author_count: function(callback) {
                Author.countDocuments({}, callback);
            },
            genre_count: function(callback) {
                Genre.countDocuments({}, callback);
            }
        },
        function(err, results) {
            res.render('index', { title: 'Local Library Home', error: err, 
                data: results });
        }
    );
}

exports.book_list = function(req, res, next) {
    Book.find({}, 'title author')
        .populate('author')
        .exec(function(err, list_books) {
            if (err)
                return next(err);
            else
                res.render('book_list', { title: 'Book List', book_list: list_books });
            });
}

exports.book_detail = function(req, res, next) {
    async.parallel({
        book: function(callback) {
            Book.findById(req.params.id)
                .populate('author')
                .populate('genre')
                .exec(callback);
        },
        bookinstances: function(callback) {
            BookInstance.find({ 'book': req.params.id })
                .exec(callback);
        }
    },function (err, results) {
        if (err)
            return next(err);
        if (results.book == null) {
            err = new Error('Book not found');
            err.status = 404;
            return next(err);
        }
        res.render('book_detail', { title: results.book.title, book: results.book, book_instances: results.bookinstances });
    });
}

exports.book_create_get = function(req, res, next) {
    // get list of authors and genres to choose from
    async.parallel({
        author_list: function(callback) {
            Author.find(callback);
        },
        genre_list: function(callback) {
            Genre.find(callback);
        }
    }, function (err, results) {
        if (err)
            return next(err);
        res.render('form_book', {title: 'Create Book', authors: results.author_list, genres: results.genre_list});
    }
    );
}

exports.book_create_post = [
    // Convert input genre into array if not already is
    (req, res, next) => {
        if (!(req.body.genre instanceof Array)) {
            if (typeof req.body.genre === 'undefined') // 'typeof'
                req.body.genre = [];
            else
                req.body.genre = new Array(req.body.genre); // how could this be converted to Array?
        }
        next();
    },
    
    validator.sanitizeBody('genre.*').escape(),
    
    validator.body('title', 'Title must not be empty').isLength({min:1}).trim(),
    validator.body('author', 'Author must not be empty').isLength({min:1}).trim(),
    validator.body('summary', 'Summary must not be empty').isLength({min:1}).trim(),
    validator.body('isbn', 'ISBN must not be empty').isLength({min:1}).trim(),
    
    // sanitize individual fields one by one, instead of wildcard(*), 
    // genre is an array, so perhaps wildcard(*) will reduce the array elements to 1.
    validator.sanitizeBody('title').escape(),
    validator.sanitizeBody('author').escape(),
    validator.sanitizeBody('summary').escape(),
    validator.sanitizeBody('isbn').escape(),
    
    (req, res, next) => {
        const errs = validator.validationResult(req);
        console.log('Here 1');
        var book = new Book({
            title: req.body.title,
            author: req.body.author,
            summary: req.body.summary,
            isbn: req.body.isbn,
            genre: req.body.genre
         });
         console.log('Here 2');
         if (!errs.isEmpty()) {
            // fetch the all author and genre documents
            console.log('There is validation errors');
            async.parallel({
                authors: function(callback) {
                    Author.find(callback);
                },
                genres: function(callback) {
                    Genre.find(callback);
                }
            },
            function (asyncErrs, asyncResults) {
                console.log('Here 3');
                if (asyncErrs) {
                    return next(asyncErrs);
                }
                // marking the currently selected as 'checked'
                console.log('Here 4');
                for (let i = 0; i < asyncResults.genres.length; i++) {
                    console.log('Here 5');
                    if (book.genre.indexOf(asyncResults.genres[i]._id) > -1) {
                        asyncResults.genres[i].checked='true';
                    }
                }
                console.log('Here 6');
                res.render('form_book', { title: 'Create Book', authors: asyncResults.authors, genres: asyncResults.genres, book: book, errors: errs.array()});
                console.log('Here 7');
            });
         }
         else {
            // Save record, go to new book url
            book.save(function(err){
                console.log('Here 8');
                if (err)
                    return next(err);
                res.redirect(book.url);
            });
         }
    }
];

exports.book_update_get = function(req, res, next) {
    // Get Book Details and Display it
    // form_book also requires authors and genres lists
    async.parallel({
        book: function(callback) {
            Book.findById(req.params.id)
            .populate('author')
            .populate('genre')
            .exec(callback);
        },
        author_list: function(callback) {
            Author.find().exec(callback);
        },
        genre_list: function(callback) {
            Genre.find().exec(callback);
        }
    
    }, function(err, results) {
        if (err) {
            return next(err);
        }
        if (results.book==null) {
            err = new Error('Book not found');
            err.status = 404;
            return next(err);
        }
        // set the 'selected' flag in the genre_list accordingly
        console.log("results.genre_list: " + results.genre_list);
        console.log("results.book.genre: " + results.book.genre);
        for (var i = 0; i < results.genre_list.length; i++) {
            for (var j = 0; j < results.book.genre.length; j++) {
                if (results.genre_list[i]._id.toString() == results.book.genre[j]._id.toString())
                    results.genre_list[i].checked = 'true';
            }
        }
        res.render('form_book', {title: 'Update Book', book: results.book, authors: results.author_list, genres: results.genre_list});
    });
}

exports.book_update_post = [

   // Convert input genre into array if not already is
   (req, res, next) => {
        console.log("1: " + req.body.genre);
        if (!(req.body.genre instanceof Array)) {
            if (typeof req.body.genre === 'undefined') // 'typeof'
                req.body.genre = [];
            else
                req.body.genre = new Array(req.body.genre); // how could this be converted to Array?
        }
        console.log("2: " + req.body.genre);
        console.log("3: " + (typeof req.body.genre));
        console.log("3.1 num-elements: " + req.body.genre.length);
        arr = new Array();
        arr.push(2345);
        arr.push(8971);
        console.log("4: " + arr);
        console.log("5: " + (typeof arr));
        next();
    },
    
    validator.sanitizeBody('genre.*').escape(),
    
    validator.body('title', 'Title must be specified').isLength({min:1}).trim(),
    validator.body('author', 'Author must be specified').isLength({min:1}).trim(),
    validator.body('summary', 'Summary must be specified').isLength({min:1}).trim(),
    validator.body('isbn', 'ISBN must be specified').isLength({min:1}).trim(),
    
    // sanitize individual fields one by one, instead of wildcard(*), 
    // genre is an array, so perhaps wildcard(*) will reduce the array elements to 1.
    validator.sanitizeBody('title').escape(),
    validator.sanitizeBody('author').escape(),
    validator.sanitizeBody('summary').escape(),
    validator.sanitizeBody('isbn').escape(),
                
    
    (req, res, next) => {
        const verr = validator.validationResult(req);        
        console.log("before new Book: " + req.body.genre);
        var book = new Book ({
            title: req.body.title,
            author: req.body.author,
            summary: req.body.summary,
            isbn: req.body.isbn,
            genre: (typeof req.body.genre=='undefined')? []: req.body.genre,
            _id: req.params.id
        });
        console.log("new Book: " + book.genre);
        if (!verr.isEmpty()) {
            async.parallel({
                author_list: function(callback) {
                    Author.find({}, callback);
                },
                genre_list: function(callback) {
                    Genre.find({}, callback);
                }
            }, function(err, results) {
                if (err)
                    return next(err);
                // Mark the 'selected' field in genre_list
                console.log("results.genre_list: " + results.genre_list);
                for (var i = 0; i < results.genre_list.length; i++)
                    if (book.genre.indexOf(results.genre_list[i]) > -1)
                        results.genre_list[i].selected = 'true';
                res.render('form_book', { title: 'Update Book', book: book, authors: results.author_list, genres: results.genre_list, errors: verr.array()});
            });
        }
        else {
            console.log("Updating book record: " + book);
            Book.findByIdAndUpdate( req.params.id, book, {}, function(err, updatedBook) {
                if (err)
                    next(err);
                else {
                    console.log("Updated book record: " + updatedBook);
                    res.redirect(updatedBook.url);
                }
            });
        }
    }

];

exports.book_delete_get = function(req, res, next) {
    async.parallel( {
        book: function(callback) {
            Book.findById(req.params.id, callback);
        },
        book_instances: function(callback) {
            BookInstance.find({book: req.params.id}, callback);
        }
    }, function(err, results) {
        if (err)
            return next(err);
        if (results.book==null) {
            err = new Error('Book not found!');
            err.status = 404;
            return next(err);
        }
        res.render('book_delete', {title: 'Delete Book', book: results.book, bookinstances: results.book_instances});
    });
}

exports.book_delete_post = [
    validator.body('bookid', 'Book ID cannot be empty.').isLength({min:1}).trim(),
    validator.sanitize('bookid').escape(),
    (req, res, next) => {
        const verrs = validator.validationResult(req);
        if (!verrs.isEmpty()) {
            err = new Error('Invalid Book ID!');
            err.status = 400;
            return next(err);
        }
        async.parallel( {
            book: function(callback) {
                Book.findById(req.body.bookid, callback);
            },
            book_instances: function(callback) {
                BookInstance.find({book: req.body.bookid}, callback);
            }
        }, function(err, results) {
            if (err)
                return next(err);
            if (results.book==null) {
                err = new Error('Book not found!');
                err.status = 404;
                return next(err);
            }
            if (results.book_instances && results.book_instances.length > 0) {
                res.render('book_delete', {title: 'Delete Book', book: results.book, bookinstances: results.book_instances});
            }
            else {
                Book.findByIdAndDelete(req.body.bookid, function(err, deletedBook) {
                    if (err)
                        return next(err);
                    res.redirect('/catalog/books');
                });
            }
        });
    }
];
