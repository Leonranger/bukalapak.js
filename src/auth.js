import queryString from 'query-string'
import { isBlank } from './util'

const OAUTH_TOKEN_PATH = '/oauth/token'

class Auth {
  constructor (client, options) {
    this.client = client
    this.options = {
      isBlank (key) { return isBlank(this[key]) },
      toParams () {
        return {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          scope: this.scope
        }
      },
      authPair () {
        return {
          username: this.username,
          password: this.password
        }
      }
    }

    this._validOptionKeys().forEach((val) => {
      if (!isBlank(options[val])) { this.options[val] = options[val] }
    })

    if (this.options.isBlank('clientId') && this.options.isBlank('clientSecret')) {
      throw new Error('Please set valid `clientId` and `clientSecret` options')
    }
  }

  registerAdapter () {
    return this.clientAuth()
  }

  login (username, password) {
    if (isBlank(username) && isBlank(password)) {
      throw new Error('Please set valid `username` and `password`')
    }

    this.options.username = username
    this.options.password = password
    return this.userAuth()
  }

  clientAuth () {
    return this._doRequest(this._authTokenUri('client_credentials'))
  }

  userAuth () {
    return this._doRequest(this._authTokenUri('password'))
  }

  refreshToken () {
    return this._doRequest(this._authTokenUri('refresh_token'))
  }

  formatRequest (options) {
    let token = this._accessToken()

    if (!isBlank(token.access_token)) {
      options.headers['Authorization'] = `Bearer ${token.access_token}`
    }

    return options
  }

  _accessToken () {
    let token = this.client.storage.getItem('access_token')

    if (typeof token !== 'object') { token = {} }

    return Object.assign({}, token, {
      isExpired () {
        return (this.created_at + this.expires_in) <= this.now()
      },

      now () {
        return Date.now()
      }
    })
  }

  _doRequest (uri) {
    return this.client.post(uri)
      .then((response) => { return response.json() })
      .then((data) => { this.client.storage.setItem('access_token', data); return data })
  }

  _authTokenUri (tokenGrant) {
    return this._token_path() + '?' + this._authTokenQuery(tokenGrant)
  }

  _authTokenQuery (tokenGrant) {
    return queryString.stringify(this._authTokenBuilder(tokenGrant))
  }

  _authTokenBuilder (tokenGrant) {
    switch (tokenGrant) {
      case 'client_credentials':
        return this._clientCredentialsBuilder()
      case 'refresh_token':
        return this._refreshTokenBuilder()
      case 'password':
        return this._passwordBuilder()
    }
  }

  _clientCredentialsBuilder () {
    return Object.assign({}, this.options.toParams(), { grant_type: 'client_credentials', scope: 'public' })
  }

  _refreshTokenBuilder () {
    let accessToken = this.client.storage.getItem('access_token')

    if (isBlank(accessToken) || isBlank(accessToken.refresh_token)) {
      throw new Error('Unable to perform refresh_token request')
    }

    return Object.assign({}, this.options.toParams(), {
      grant_type: 'refresh_token',
      access_token: accessToken.access_token,
      refresh_token: accessToken.refresh_token
    })
  }

  _passwordBuilder () {
    if (this.options.isBlank('username') && this.options.isBlank('password')) {
      throw new Error('Unable to perform resource owner password credentials request')
    }

    return Object.assign({}, this.options.toParams(), this.options.authPair(), { grant_type: 'password' })
  }

  _validOptionKeys () {
    return ['clientId', 'clientSecret', 'username', 'password', 'scope', 'tokenPath']
  }

  _token_path () {
    return this.options.tokenPath || OAUTH_TOKEN_PATH
  }
}

export default Auth
