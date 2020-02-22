var Author = require('../models/author');
var Book = require('../models/book');
var async = require('async');
var { body, validationResult } = require('express-validator/check');
var { sanitizeBody } = require('express-validator/filter');
var validator = require('express-validator');

exports.authors_list = function(req, res, next) {
    Author.find()
        .populate('author') // why?
        .sort([['family_name', 'ascending']])
        .exec(function(err, list_authors) {
            if (err)
                return next(err);
            else
                res.render('author_list', { title: 'Author List', author_list: list_authors });
        });
}

exports.author_detail = function(req, res, next) {
    async.parallel({
        author: function(callback) {
            Author.findById(req.params.id).exec(callback);
        },
        books: function(callback) {
            Book.find({ author: req.params.id }, 'title summary').exec(callback);
        }
    }, function(err, results) {
        if (err)
            return next(err);
        if (results.author == null) {
            err = new Error('Author not found.');
            err.status = 404;
            return next(err);
        }
        res.render('author_detail', { title: results.author.name, author: results.author, books: results.books });
    });
}

exports.author_create_get = function(req, res) {
    res.render('form_author', {title: 'Create Author'});
}

exports.author_create_post = [
    body('first_name').isLength({min: 1}).trim().withMessage('First name must be specified').isAlphanumeric().withMessage('First name has non-alphanumeric characters'),
    body('family_name').isLength({min: 1}).trim().withMessage('Family name must be specified').isAlphanumeric().withMessage('Family name has non-alphanumeric characters'),
    body('date_of_birth', 'Invalid date of birth').optional({checkFalsy: true}).isISO8601(),
    body('date_of_death', 'Invalid date of death').optional({checkFalsy: true}).isISO8601(),
    
    sanitizeBody('first_name').escape(),
    sanitizeBody('family_name').escape(),
    sanitizeBody('date_of_birth').toDate(),
    sanitizeBody('date_of_death').toDate(),
    
    (req, res, next) => {
        const errs = validationResult(req);
        if (!errs.isEmpty()) {
            res.render('form_author', { title: 'Create Author', author: req.body, errors: errs.array() });
            return;
        }
        else {
            var author = new Author(
            {
                first_name: req.body.first_name,
                family_name: req.body.family_name,
                date_of_birth: req.body.date_of_birth,
                date_of_death: req.body.date_of_death
            });
            author.save(function (err) {
                if (err)
                    return next(err);
                res.redirect(author.url);
            });
        }
    }
];

exports.author_update_get = function(req, res, next) {
    Author.findById(req.params.id, function(err, author) {
        if (err)
            return next(err);
        console.log('sending this information to form_author.pug: ' + author);
        res.render('form_author', {title: 'Update Author', author: author});
    });
}

exports.author_update_post = [
    validator.body('first_name').isLength({min:1}).trim().withMessage('First name cannot be empty').isAlphanumeric().withMessage('First name cannot have non-alphanumeric characters.'),
    validator.body('family_name').isLength({min:1}).trim().withMessage('Family name cannot be empty').isAlphanumeric().withMessage('Family name cannot have non-alphanumeric characters.'),
    validator.body('date_of_birth', 'Invalid date-of-birth.').optional({checkFalsy:true}).isISO8601(),
    validator.body('date_of_death', 'Invalid date-of-death.').optional({checkFalsy:true}).isISO8601(),
    
    validator.sanitizeBody('first_name').escape(),
    validator.sanitizeBody('family_name').escape(),
    validator.sanitizeBody('date_of_birth').toDate(),
    validator.sanitizeBody('date_of_death').toDate(),
    
    (req, res, next) => {
        const verrs = validator.validationResult(req);
        var author = new Author({
            _id: req.params.id,
            first_name: req.body.first_name,
            family_name: req.body.family_name,
            date_of_birth: req.body.date_of_birth,
            date_of_death: req.body.date_of_death
        });
        if (!verrs.isEmpty()) {
            res.render('form_author', {title: 'Update Author', author: author, errors: verrs.array()});
        }
        else {
            Author.findByIdAndUpdate(req.params.id, author, {}, function(err) {
                if (err)
                    return next(err);
                res.redirect(author.url);
            });
        }
    }
];

exports.author_delete_get = function(req, res) {
    async.parallel({
        author: function(callback) {
                    Author.findById(req.params.id, callback);
                },
        author_books: function(callback) {
                    Book.find({author: req.params.id}, callback);
                }
    },
    function (err, results) {
        if (err)
            return next(err);
        if (results.author==null)
            res.redirect('/catalog/authors'); // allow user to choose again
        else
            res.render('author_delete', {title: 'Delete Author', author: results.author, 
                author_books: results.author_books});
    });
}

exports.author_delete_post = [

    validator.body('authorid', 'Author ID not specified.').isLength({min:1}).trim(),
    
    validator.sanitizeBody('authorid').escape(),
    
    (req, res, next) => {
        const verrs = validator.validationResult(req);
        
        if (!verrs.isEmpty()) {
            res.redirect('/catalog/authors'); // Author remains
        }
        else {
            // Double-Check if the Author has books.
            async.parallel({
                author: function(callback) {
                        Author.findById(req.body.authorid, callback);
                    },
                author_books: function(callback) {
                        Book.find({author: req.body.authorid}, callback);
                    }
            },
            function (err, results) {
                if (err)
                    return next(err);
                if (results.author==null)
                    res.redirect('/catalog/authors'); // allow user to choose again
                else {
                    if (results.author_books.length > 0) {
                        res.render('author_delete', {title: 'Delete Author', author: results.author, 
                            author_books: results.author_books});
                    }
                    else {
                        Author.findByIdAndRemove(req.body.authorid, function(err) {
                        if (err)
                            return next(err);
                        res.redirect('/catalog/authors');}); // author should not appear in list now.
                    }
                }
            });
        }
    }
];

