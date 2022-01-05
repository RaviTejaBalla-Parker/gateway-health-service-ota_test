var rp = require('request-promise');

getElevateApiToken = (elevate_token_api_url, elevate_token_api_email, elevate_token_api_pass) => {
    return new Promise((resolve, reject) => {        
        var getElevateToken = {
            method: 'POST',
            url: elevate_token_api_url,            
            formData: {
                'email': elevate_token_api_email,
                'password': elevate_token_api_pass                
            }
        }

        rp(getElevateToken)
            .then(elevateTokenResp => {
                return (resolve(JSON.parse(elevateTokenResp).token));
            })
            .catch(error => reject(error));
    });
}

module.exports = {
    getElevateApiToken  
}