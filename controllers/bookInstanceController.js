var BookInstance = require('../models/bookinstance');
var Book = require('../models/book');
var validator = require('express-validator');
var async = require('async');
const  status_list = [ 'Maintenance', 'Available', 'Loaned', 'Reserved' ];

exports.bookinstance_list = function(req, res, next) {
    BookInstance.find()
        .populate('book')
        .exec(function(err, list_bookinstances) {
            if (err)
                return next(err);
            else
                res.render('bookinstance_list', { title: 'Book Instance List', 
                    bookinstance_list: list_bookinstances});
        });
}

exports.bookinstance_detail = function(req, res) {
    BookInstance.findById(req.params.id)
        .populate('book')
        .exec(function(err, bookinstance) {
            if (err)
                return next(err);
            if (bookinstance == null) {
                err = new Error('Book instance not found.');
                err.status = 404;
                return next(err);
            }
            res.render('bookinstance_detail', {title: 'Copy:' + bookinstance.book.title, bookinstance: bookinstance });
        });
}

exports.bookinstance_create_get = function(req, res, next) {
    Book.find({}, 'title').exec(function(err, book_list) {
        if (err)
            return next(err);
        else
            res.render('form_bookinstance', {title: 'Create BookInstance', book_list: book_list, status_list: status_list});
        });
}

exports.bookinstance_create_post = [
    
    validator.body('book', 'Title must not be empty').isLength({min:1}).trim(),
    validator.body('imprint', 'Imprint must not be empty').isLength({min:1}).trim(),
    validator.body('status', 'Status must not be empty').isLength({min:1}).trim(),
    validator.body('due_back', 'Invalid date.').optional({checkFalsy: true}).isISO8601(),
    validator.body('due_back').custom( (value, {req}) => {
            // check that 'due_back' is present whenever status not 'Available'
            if ((req.body.status != 'Available') && (! value))
                throw new Error('Due date must be entered if Status is not Available');
            return true;
        }),
    
    validator.sanitizeBody('book').escape(),
    validator.sanitizeBody('imprint').escape(),
    validator.sanitizeBody('status').escape(),
    validator.sanitizeBody('due_back').toDate(),
    
    (req, res, next) => {
        // check validator errors
        console.log('Getting validator results');
        verrs = validator.validationResult(req);
        console.log(verrs.array());

        // create new Record
        var bookinstance = new BookInstance(
                {
                    book: req.body.book,
                    imprint: req.body.imprint,
                    status: req.body.status,
                    due_back: req.body.due_back
                }
            );
        // prepare data required to render page again.
        if (!verrs.isEmpty()) {
            // render the form with error message
            Book.find({}, 'title').exec(function(err, book_list) {
                if (err)
                    return next(err);
                res.render('form_bookinstance', {title: 'Create BookInstance', 
                    errors: verrs.array(), book_list: book_list, status_list: status_list,
                    bookinstance: bookinstance});
                });
        }
        else {
            // save new Record and display this           
            bookinstance.save(function(err) {
                if (err)
                    return next(err);
                else
                    res.redirect(bookinstance.url);
            });
        }
    }
];

exports.bookinstance_update_get = function(req, res, next) {
    async.parallel({
        book_inst: function(callback) {
            BookInstance.findById(req.params.id).exec(callback);
        },
        book_list: function(callback) {
            Book.find({}, 'title').exec(callback);
        }
    }, function(err, results) {
        if (err)
            return next(err);
        if (results.book_inst==null) {
            err = new Error('Book instance not found.');
            err.status = 404;
            return next(err);
        }
        res.render('form_bookinstance', {title: 'Update Book-Instance', bookinstance: results.book_inst, book_list: results.book_list, status_list: status_list});
    });
}

exports.bookinstance_update_post = [
    validator.body('book', 'Book field cannot be empty.').isLength({min:1}).trim(),
    validator.body('imprint', 'Imprint field cannot be empty.').isLength({min:1}).trim(),
    validator.body('status', 'Status field cannot be empty.').isLength({min:1}).trim(),
    validator.body('due_back', 'Due Date format is invalid').optional({checkFalsy:true}).isISO8601(),
                
    validator.sanitizeBody('book').escape(),
    validator.sanitizeBody('imprint').escape(),
    validator.sanitizeBody('status').escape(),
    validator.sanitizeBody('due_back').toDate(),
    
    (req, res, next) => {
        const verrs = validator.validationResult(req);
       
        async.parallel({
            book_inst: function(callback) {
                BookInstance.findById(req.params.id).exec(callback);
            },
            book_list: function(callback) {
                Book.find({}, 'title').exec(callback);
        }
        }, function(err, results) {
            if (err)
                return next(err);
            if (results.book_inst==null) {
                err = new Error('Book instance not found.');
                err.status = 404;
                return next(err);
            }
            results.book_inst = new BookInstance({
                _id: req.params.id,
                book: req.body.book,
                imprint: req.body.imprint,
                status: req.body.status,
                due_date: req.body.due_back
            });
            if (!verrs.isEmpty()) {
                res.render('form_bookinstance', {title: 'Update Book-Instance', bookinstance: results.book_inst, book_list: results.book_list, status_list: status_list, errors: verrs.array()});
            }
            else {
                // update record
                BookInstance.findByIdAndUpdate(req.params.id, results.book_inst, {}, function(err){
                    if (err)
                        return next(err);
                    res.redirect(results.book_inst.url);
                });
            }
        });
    }
];

exports.bookinstance_delete_get = function(req, res, next) {
    BookInstance.findById(req.params.id, function(err, book_inst) {
        if (err)
           return next(err);
        if (book_inst==null) {
           err = new Error('Book Instance not found.');
           err.status = 404;
           return next(err);
        }
        res.render('bookinstance_delete', {title: 'Delete Book Instance', bookinstance: book_inst});
    });
}

exports.bookinstance_delete_post = [
    validator.body('bookinstanceid', 'Bookinstance ID cannot be empty.').isLength({min:1}).trim(),
    validator.sanitizeBody('bookinstanceid').escape(),
    (req, res, next) => {
        const verr = validator.validationResult(req);
        if (!verr.isEmpty()) {
            var err = new Error('Incorrect input parameter' + verr);
            err.status = 400;
            return next(err);
        }
        BookInstance.findByIdAndDelete(req.params.id, function(err) {
            if (err)
               return next(err);
            res.redirect('/catalog/bookinstances');
            });
    }
];



