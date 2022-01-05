var rp = require('request-promise');
var getOktaToken = require('./fetchOktaToken').getOktaToken;

let oktaToken = undefined;
let partnumbers_api_url;
// let okta_token_api_url;
// let okta_token_api_userid;
// let okta_token_api_pass;

async function getPartNumbersData(OKTA_PARAMETERS, PART_NUMBERS_API) {
    let isAPIExecuted = false; let retryCount = 0; let maxAttempt = 4;
    let pageCounter = 0;
    let recordLimit = 50;
    let partNumberDetails = [];
    partNumberDetails.length = 0;
    
    partnumbers_api_url = PART_NUMBERS_API;
    let okta_token_api_url = OKTA_PARAMETERS.oktaAPIAuthUrl;
    let okta_token_api_userid = OKTA_PARAMETERS.oktaUserId;
    let okta_token_api_pass = OKTA_PARAMETERS.oktaPassword;

    console.log(`getPartNumbersData`);
    try {

        oktaToken = await getOktaToken(okta_token_api_url, okta_token_api_userid, okta_token_api_pass);

        let partNumbersCount = await getPartNumbersRecordCount(oktaToken);

        let totalPartNumberPages = (partNumbersCount / recordLimit) === 0 ? parseInt(partNumbersCount / recordLimit) : parseInt((partNumbersCount / recordLimit)) + 1;

        console.log(`partNumbersCount: ${partNumbersCount}`);
        console.log(`totalPartNumberPages: ${totalPartNumberPages}`);

        while (!isAPIExecuted && retryCount <= maxAttempt && partNumbersCount > 0) {
            try {
                for (let nextPage = pageCounter; nextPage < totalPartNumberPages; nextPage++) {
                    pageCounter = nextPage;
                    partNumberDetails = await getPartNumbersByPage(nextPage, oktaToken, partNumberDetails, recordLimit);
                    console.log(`Page ${nextPage}; partNumberDetails lenght:${partNumberDetails.length}`);
                    retryCount = 0;                    
                }
                isAPIExecuted = true;
            } catch (error) {
                console.log(`Failed to fetch page ${pageCounter}:${error.message}; Retry page ${pageCounter}`);
                //console.log(error);
                oktaToken = await getOktaToken(okta_token_api_url, okta_token_api_userid, okta_token_api_pass);
                isAPIExecuted = false;
                retryCount = retryCount + 1;

                if (retryCount > maxAttempt) {
                    console.log(`Failed to fetch data from gateway api at page ${pageCounter}`);
                }

                if (pageCounter > totalPartNumberPages) {
                    console.log(`pageCounter > total pages: ${pageCounter}`);
                    isAPIExecuted = true;
                }

            }
        }
    }
    catch (error) {
        console.log(error.message);
        throw error;
    }
    console.log(`partNumberDetails length:${partNumberDetails.length}`);
    return partNumberDetails;
}

function concatPartNumberDataArrays(array1, array2) {
    if (array2) {
        return [...array2, ...array1.data];
    }
    return array1.data;
}

getPartNumbersRecordCount = (oktaToken) => {
    return new Promise((resolve, reject) => {
        var getPartNumbersRecordCountOption = {
            method: 'GET',
            url: `${partnumbers_api_url}?page=0`,
            headers: { 'authorization': `Bearer ${oktaToken}` },
            rejectUnauthorized: false            
        }

        rp(getPartNumbersRecordCountOption)
            .then((response) => {                
                return resolve(JSON.parse(response).total)
            })
            .catch(error => reject(error));
    })
}

getPartNumbersByPage = (pageNo, oktaToken, partNumberDetails, recordLimit) => {
    return new Promise((resolve, reject) => {
        var getPartNumbersByPageOption = {
            method: 'GET',
            url: `${partnumbers_api_url}?page=${pageNo}&pageSize=${recordLimit}`,
            headers: { 'authorization': `Bearer ${oktaToken}` },
            rejectUnauthorized: false
        }

        rp(getPartNumbersByPageOption)
            .then((response) => {
                let details = JSON.parse(response);
                if (details.data.length > 0) {
                    let concatenatedArray = concatPartNumberDataArrays(details, partNumberDetails);
                    return resolve(concatenatedArray);
                }
                return resolve(partNumberDetails);
            })
            .catch(error => reject(error));
    })
}

module.exports = {
    getPartNumbersData
}
