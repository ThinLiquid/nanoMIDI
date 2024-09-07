export default class Element {
  element: HTMLElement

  constructor (tagOrElement: string | HTMLElement = 'div') {
    this.element = typeof tagOrElement === 'string' ? document.createElement(tagOrElement) : tagOrElement
  }

  appendTo (parent: HTMLElement | Element): this {
    parent.append(this.element)
    return this
  }

  append (child: HTMLElement | Element): this {
    this.element.append(child instanceof Element ? child.element : child)
    return this
  }

  prependTo (parent: HTMLElement | Element): this {
    parent.prepend(this.element)
    return this
  }

  prepend (child: HTMLElement | Element): this {
    this.element.prepend(child instanceof Element ? child.element : child)
    return this
  }

  remove (): this {
    this.element.remove()
    return this
  }

  on (event: string, callback: () => unknown | EventListenerObject): this {
    this.element.addEventListener(event, callback)
    return this
  }

  off (event: string, callback: () => unknown | EventListenerObject): this {
    this.element.removeEventListener(event, callback)
    return this
  }

  style (styles: Record<string, string>): this {
    Object.assign(this.element.style, styles)
    return this
  }
}
