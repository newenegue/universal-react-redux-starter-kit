import React from 'react'
import { match } from 'react-router'
import { renderToStaticMarkup } from 'react-dom/server'
import { syncHistoryWithStore } from 'react-router-redux'
import createMemoryHistory from 'react-router/lib/createMemoryHistory'
import { getStyles } from 'simple-universal-style-loader'
import Helmet from 'react-helmet'
import createStore from './store/createStore'
import AppContainer from './containers/AppContainer'
import _debug from 'debug'
import * as Assetic from './modules/Assetic'
import defaultLayout from '../config/layout'

const debug = _debug('app:server:universal:render')

export default getClientInfo => {
  return async function (ctx, next) {
    const initialState = {}
    const memoryHistory = createMemoryHistory(ctx.req.url)
    const store = createStore(initialState, memoryHistory)
    const routes = require('./routes/index').default(store)
    const history = syncHistoryWithStore(memoryHistory, store, {
      selectLocationState: (state) => state.router
    })

    match({history, routes, location: ctx.req.url}, async (err, redirect, props) => {
      debug('Handle route', ctx.req.url)

      let head, content
      let {app, vendor} = getClientInfo().assetsByChunkName

      let scripts = Assetic
        .getScripts(([vendor, app]))
        .map((asset, i) => <script key={i} type='text/javascript' src={`${asset}`}></script>)
      let links = Assetic
        .getStyles(([vendor, app]))
        .map(asset => ({
          rel: 'stylesheet',
          href: `${asset}`
        }))

      // React-helmet will overwrite the layout once the client start running so that
      // we don't have to remove our unused styles
      let layout = {...defaultLayout,
        link: links,
        style: getStyles().map(style => ({
          cssText: style.parts.map(part => `${part.css}\n`).join('\n')
        })),
        script: [
          {type: 'text/javascript', innerHTML: `___INITIAL_STATE__ = ${JSON.stringify(store.getState())}`}
        ]
      }

      const render = () => (
        '<!DOCTYPE html>' +
        renderToStaticMarkup(
          <html>
            <head>
              {head.title.toComponent()}
              {head.meta.toComponent()}
              {head.base.toComponent()}
              {head.link.toComponent()}
              {head.script.toComponent()}
              {head.style.toComponent()}
            </head>
            <body>
              <div id='root' style={{height: '100%'}} dangerouslySetInnerHTML={{__html: content}} />
              {scripts}
            </body>
          </html>
        )
      )

      // ----------------------------------
      // Internal server error
      // ----------------------------------
      if (err) {
        content = renderToStaticMarkup(
          <div>
            <Helmet {...{...layout, title: '500 - Internal server error'}} />
            <h3>Error 500</h3>
            <div>{'An error occurred:' + err}</div>
          </div>
        )
        head = Helmet.rewind()
        scripts = []
        ctx.status = 500
        ctx.body = render()
        return
      }

      // ----------------------------------
      // No route matched
      // This should never happen if the router has a '*' route defined
      // ----------------------------------
      if (next &&
        typeof err === 'undefined' &&
        typeof redirect === 'undefined' &&
        typeof props === 'undefined') {
        debug('No route found.')

        // We could call our next middleware maybe
        // await next()
        // return

        // Or display a 404 page
        content = renderToStaticMarkup(
          <div>
            <Helmet {...{...layout, title: '404 - Page not found'}} />
            <h3>Error 404</h3>
            <div>404 - Page not found</div>
          </div>
        )
        head = Helmet.rewind()
        scripts = []
        ctx.status = 404
        ctx.body = render()
        return
      }

      // ----------------------------------
      // Everything went fine so far
      // ----------------------------------
      content = renderToStaticMarkup(
        <AppContainer
          history={history}
          routerKey={Math.random()}
          routes={routes}
          store={store}
          layout={layout} />
      )
      head = Helmet.rewind()
      ctx.status = 200
      ctx.body = render()
    })
  }
}
