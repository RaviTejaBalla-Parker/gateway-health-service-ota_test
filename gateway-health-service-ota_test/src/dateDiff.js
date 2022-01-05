
function getDateDifference(shipDate, currentDate) {
    let diffDays = DateDiff.inDays(shipDate, currentDate);
    let diffWeeks = DateDiff.inWeeks(shipDate, currentDate);
    let diffMonths = DateDiff.inMonths(shipDate, currentDate);
    let diffYears = DateDiff.inYears(shipDate, currentDate);

    let contractDateDiff ={days:diffDays, weeks:diffWeeks, months: diffMonths, years: diffYears};

    return contractDateDiff
}

var DateDiff = {

    inDays: function (d1, d2) {
        let t2 = d2.getTime();
        let t1 = d1.getTime();
        // getTime() => returns number of milliseconds since 1Jan1970
        // 1 sec = 1000 milliseconds
        // Number of seconds in a day = 24 * 60 * 60 = 86400 sec
        // days * 24 * 60 * 60 * 1000 = days * 86400000 ms

        return parseInt((t2 - t1) / (24 * 3600 * 1000));
    },

    inWeeks: function (d1, d2) {
        let t2 = d2.getTime();
        let t1 = d1.getTime();

        return parseInt((t2 - t1) / (24 * 3600 * 1000 * 7));
    },

    inMonths: function (d1, d2) {
        let d1Y = d1.getFullYear();
        let d2Y = d2.getFullYear();
        let d1M = d1.getMonth();
        let d2M = d2.getMonth();
        // d2M + 12 * d2Y => returns number of months since year 0 (1Jan0001)
        return (d2M + 12 * d2Y) - (d1M + 12 * d1Y);
    },

    inYears: function (d1, d2) {
        return d2.getFullYear() - d1.getFullYear();
    }
}

// var d1 = new Date("2020-01-04");
// var d2 = new Date();
// var days = DateDiff.inDays(d1, d2);
// var weeks = DateDiff.inWeeks(d1, d2);
// var months = DateDiff.inMonths(d1, d2);
// var years = DateDiff.inYears(d1, d2);
// console.log(`days: ${days}`);
// console.log(`weeks: ${weeks}`);
// console.log(`months: ${months}`);
// console.log(`years: ${years}`);

module.exports = {
    getDateDifference
}
