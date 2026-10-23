var sendResponse = require('./response').sendResponse;

module.exports = function (router) {
    var homeRoute = router.route('/');

    homeRoute.get(function (req, res) {
        var connectionString = process.env.TOKEN;
        return sendResponse(res, 200, 'My connection string is ' + connectionString, {});
    });
};
