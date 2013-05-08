
declare('loginData', function () {

    var self;
    var loginData = self = {

        errors: {
            login: {
                invalidEmail: 1,
                invalidPassword: 2,
                invalidCredentials: 4,
                lockedOut: 8,
                general: 16
            },
            create: {
                invalidEmail: 1,
                invalidPassword: 2,
                passwordMatch: 4,
                emailInUse: 8,
                general: 16
            }
        },

        // Calls the login service, and then executes the 'complete' callback.
        // Passes a bitfield of error states to the callback (or 0 if successful)
        login: function (email, password, complete) {

            var err = 0;

            if (!email)
                err |= self.errors.login.invalidEmail;

            if (!password)
                err |= self.errors.login.invalidPassword;

            if (err)
                return complete(err);

//@if norest

            setTimeout(function() {
                complete(0);
            }, 1000);

//@else

            $.ajax({
                url: '/Account/LoginAsync',
                data: { UserName: email, Password: password },
                type: 'post',
                dataType: 'json',
                success: function (body) {
                    if (body.success)
                        return complete(0);
                    complete(body.error);
                },
                error: function () {
                    complete(self.errors.login.general);
                }
            });

//@endif
        },

        validatePassword: function (password) {
            return /(?!^[0-9]*$)(?!^[a-zA-Z]*$)^([a-zA-Z0-9!@#$%\\*]{6,})$/.test(password);
        },

        create: function (email, password, confirmPassword, optIn, complete) {

            var err = 0;

            if (!_.email.test(email))
                err |= self.errors.create.invalidEmail;

            if (!self.validatePassword(password))
                err |= self.errors.create.invalidPassword;

            if (password != confirmPassword)
                err |= self.errors.create.passwordMatch;

            if (err)
                return complete(err);

            $.ajax({
                url: '/Account/RegisterAsync',
                data: { UserName: email, Password: password, ConfirmPassword: confirmPassword, OptIn: optIn },
                type: 'post',
                dataType: 'json',
                success: function (body) {
                    if (body.success) {
                        return complete(0);
                    }
                    complete(body.error);
                },
                error: function () {
                    complete(self.errors.create.general);
                }
            });
        }

    };

    return loginData;

});