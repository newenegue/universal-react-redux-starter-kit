import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

export default (head, content = '', scripts = undefined) => (
  '<!DOCTYPE html>' +
  renderToStaticMarkup(
    <html lang='en'>
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
