module.exports.verifyReportPasskey = (req, res, next) => {
    const enteredPasskey = req.headers["x-report-passkey"];
    const correctPasskey = "campuscollab123";

    if (!enteredPasskey) {
        return res.status(401).json({
            message: "Passkey is required to view reports"
        });
    }

    if (enteredPasskey !== correctPasskey) {
        return res.status(403).json({
            message: "Wrong passkey. Reports are still hidden."
        });
    }

    next();
};