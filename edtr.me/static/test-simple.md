| First Header  | Second Header | Third Header         |
| :------------ | :-----------: | -------------------: |
| First row     | Data          | Very long data entry |
| Second row    | **Cell**      | *Cell*               |
| Third row     | Cell that spans across two columns  | boo|

```ruby
require 'redcarpet'
markdown = Redcarpet.new("Hello World!")
puts markdown.to_html
```

# Text formatting

Italic:
  use *one asterisk* or _one underscore_

Bold:
  use **two asterisks** or __two underscores__

# Links and Images

Links automatically work:
  http://example.com

Custom links:
  [linked text](http://thelink.com "Optional Title")

Images:
  ![mouse-over text](
http://imikimi.com/images/browser_lite/logo_small.png?1353454576)

# Horizontal line

A blank line, followed by a line with only three dashes.
---


# Headers (level 1)

Headers are preceed by one or more # symbols and a space.

## Header Level 2

### Header Level 3

#### Header Level 4

##### Header Level 5

###### Header Level 6



# Quotes
 Quote some text.
 > quote inside quote


# Bullets

* Start one or more lines with asterisk
+ or plus
- or minus.


# Numbered list

1. Start any line with any number
2. followed by a period '.'
1. (it doesn't matter what the number is)
