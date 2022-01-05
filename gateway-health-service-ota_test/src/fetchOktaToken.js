var rp = require('request-promise');

encodePassword = (okta_token_api_userid, okta_token_api_pass) => {
    const userId = okta_token_api_userid;
    const password = okta_token_api_pass;
  
    const newUserPassword = `${userId}:${password}`;
    let tmp = Buffer.from(newUserPassword).toString("base64");
    console.log(tmp);
    return Buffer.from(newUserPassword).toString("base64");
  };

getOktaToken = (okta_token_api_url, okta_token_api_userid, okta_token_api_pass) => {
    return new Promise((resolve, reject) => {        
        var getOktaTokenOptions = {
            method: 'POST',
            url: okta_token_api_url,                        
            form: {
                'grant_type': 'client_credentials',
                'scope': 'access_token'                
            },
            headers: { 
                Accept: '*/*',                
                Authorization: `Basic ${encodePassword(okta_token_api_userid, okta_token_api_pass)}`,
            }, 
            strictSSL: true  
        }

        rp(getOktaTokenOptions)
            .then(oktaTokenResp => {
                return (resolve(JSON.parse(oktaTokenResp).access_token));
            })
            .catch(error => reject(error));            
    });
}

module.exports = {
    getOktaToken  
}