const bCrypt = require('bcrypt-nodejs');
const nodemailer = require('nodemailer');
const hbs = require('nodemailer-express-handlebars');
const env = process.env.NODE_ENV || 'development';
const config = require('../config/config.json')[env];
const jwt = require("jsonwebtoken");

var exports = module.exports = {}

exports.apiRegister = async function (req, res) {

    const { User } = require('../models');

    const email = req.body.email;
    const password = req.body.password;

    function createNewUser(data) {
        User.create(data).then(function (newUser, created) {

            const options = {
                viewEngine: {
                extname: '.hbs',
                layoutsDir: 'app/views/email/',
                defaultLayout : 'registration',
                partialsDir : 'app/views/partials/'
                },
            viewPath: 'app/views/email/',
            extName: '.hbs'
            };

            const transporter = nodemailer.createTransport({
                host: config.smtpemail,
                service: 'gmail',
                auth: {
                    user: config.smtpemail,
                    pass: config.smtppass
                },
                secure: true,
                logger: true,
                ignoreTLS: true
                });

                transporter.use('compile', hbs(options));
                transporter.sendMail({
                    from: config.smtpemail,
                    to: data.email,
                    subject: 'DDH registration!',
                    template: 'registration',
                    context: {
                        user : data.firstname + " " + data.lastname
                    }
                    }, function (error, response) {
                        console.log(error)
                        transporter.close();
                    });

                    if (!newUser) {
                        res.json({ status: 'Unexpected error!' })
                        return;
                    }
                    if (newUser) {
                        res.json({ status: 'Successfully registered!' })
                        return;
                    }
                });
    }

    const generateHash = function(password) {
        return bCrypt.hashSync(password, bCrypt.genSaltSync(8), null);
    };

    const user = await User.findOne({ where: { email: email } })
            
    if (user) {
        res.json({ status: 'User already exist' })
        return;
    }
            
    const userPassword = generateHash(password);
    const regHashRow = generateHash(email + password);
                    
    //Remove slashes
    const regHash = regHashRow.replace(/\//g, "");

    const data =
        {
            email: email,
            password: userPassword,
            firstname: req.body.firstname,
            lastname: req.body.lastname,
            role: 'User',
            reghash: regHash
        };  
        
    createNewUser(data);
        
}

exports.apiNewPassHandler = async function (req, res) {

    // Sequelize model require
    const { User } = require('../models');
    
    const userEmail = req.body.email;

    function setPassResetDate(user) {
        const userInfo = user.get();

        var date = new Date();
        var twoMin = 2 * 60 * 1000;
        
        if((date - userInfo.resetdate) > twoMin) {

            User.update({resetdate: new Date()}, { where: {email: userEmail}}).then(function (newUser, created) {

                const userName = userInfo.firstname + " " + userInfo.lastname;
                const reghash = userInfo.reghash;

                var options = {
                    viewEngine: {
                    extname: '.hbs',
                    layoutsDir: 'app/views/email/',
                    defaultLayout : 'passreset',
                    partialsDir : 'app/views/partials/'
                    },
                    viewPath: 'app/views/email/',
                    extName: '.hbs'
                    };

                    var transporter = nodemailer.createTransport({
                        host: config.smtpemail,
                        service: 'gmail',
                        auth: {
                            user: config.smtpemail,
                            pass: config.smtppass
                        },
                        secure: true,
                        logger: true,
                        ignoreTLS: true
                    });

                    transporter.use('compile', hbs(options));
                    transporter.sendMail({
                        from: config.smtpemail,
                        to: userEmail,
                        subject: 'DDH Reset password!',
                        template: 'passreset',
                        context: {
                            user: userName,
                            reghash: reghash
                        }
                        }, function (error, response) {
                            console.log(error)
                            transporter.close();
                    });
                    res.json({ status: 'Your password has been reseted!' })
                    return;
                });
        } else {
            res.json({ status: 'Your password already reseted, try again later!' })
            return;
        }

    }

    const user = await User.findOne({ where: { email: userEmail } });

    if (!user) {
        res.json({ status: 'Wrong email address!' })
        return;
    } 

    setPassResetDate(user);
}

exports.apiResetPasswordHandler = async function (req, res) {
    
    const { User } = require('../models');

    var generateHash = function(password) {
        return bCrypt.hashSync(password, bCrypt.genSaltSync(8), null);
    };
    
    var regHash = req.params.id;

    const newPassword = req.body.password;
    const reNewPassword = req.body.repassword;
    const cryptedPassword = generateHash(newPassword);

    if (newPassword === reNewPassword) {

        const user = await User.findOne({ where: { reghash: regHash } });
        if (user) {
            User.update({ password: cryptedPassword }, { where: { reghash: regHash } }).then(function (newUser, created) {
                res.json({ status: 'You successfully reseted your password now you can login!' })
                return;
            });
        } else {
            res.json({ status: 'Something went wrong!' })
            return;
        }     
   
    } else {
        res.json({ status: 'Password must match!' })
        return;
    }
    
}

exports.apiLogin = async function (req, res) {

    const { User } = require('../models');

    const email = req.body.email;
    const password = req.body.password;
        
    const isValidPassword = function(userpass, password) {
        return bCrypt.compareSync(password, userpass);
    }
        
    const user = await User.findOne({ where: { email: email } })
            
    if (!user) {
        res.json({ status: 'Wrong email address.' })
        return;
    }
        
    if (!isValidPassword(user.password, password)) {
        res.json({ status: 'Incorrect password.' })
        return;
    }
            
    const userInfo = user.get();

    //Gerenate an access token

    const generateAccessToken = (user) => {
        return jwt.sign(
            { id: user.id, role: user.role },
            config.jwtkey,
            { expiresIn: "15m" }
        );
    }

    const accessToken = generateAccessToken(userInfo);

    res.cookie('jwt', accessToken, {
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    })

    res.send({message: 'Success!'});
 
}

exports.apiUser = async function (req, res) {

    const { User } = require('../models');

    try {
        const cookie = req.cookies['jwt'];

        const claims = jwt.verify(cookie, config.jwtkey);

        if (!claims) {
            res.json({
                message: "Invalid Token!",
                auth: false
            })
            return;
        }

        const user = await User.findOne({ where: { id: claims.id } });

        const { password, reghash, resetdate, updatedAt, createdAt, uuid, ...data } = await user.toJSON();

        res.send({userInfo: data, auth: true});

    } catch {
        res.json({
            message: "Invalid Token!",
            auth: false
        })
        return;

    }
 
}

exports.apiLogout = async function (req, res) {

    res.cookie('jwt', "", { maxAge: 0 })
    
    res.send({message: "Successfully logged out!"})
 
}