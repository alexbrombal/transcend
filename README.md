Transcend
=========


### Contents

- [Introduction](#introduction)
- [Usage](#usage)
- [Why?](#why)
- [How?](#how)
   - [Basic concepts](#basic-concepts)
   - [Directives](#directives)
   - [Configuration](#configuration)
- [Types of Directives](#types-of-directives)
   - [//@require](#require)
   - [//@master](#master)
   - [//@if, //@else, //@elseif, //@endif](#if-else-elseif-endif)


## Introduction

Transcend is a JavaScript preprocessor. If you are familiar with CSS preprocessing tools such as Sass and Less,
Transcend will be instantly familiar.

Transcend **does not** change the way you write JavaScript. It doesn't change or provide additional syntax or features
to the language itself; in fact, at its core, Transcend is really just a plain text preprocessor. Transcend simply reads
files from input directory, and outputs a duplicate copy in another location. Before it outputs, it first looks
in your files for special lines called **directives**, which can modify the output.

Directives are simply specially formatted comments (`//@` + **directive keyword** + **arguments**):

```js
//@require /lib/jquery.js
```

Transcend was originally created to provide a simple way to optimize files for loading on websites. The built-in
directives `//@require` and `//@parent` provide the most useful functionality of Transcend: including one JavaScript
file into another, and maintaining the dependency chain between a JavaScript file and its required files.

However, since then it has expanded into a fully extensible tool for preprocessing JavaScript files in any way
imaginable. Installing plugins is as easy as `npm install -g transcend-[plugin]`, and creating plugins simply involves
creating an npm module that implements a set of methods.



## Usage

Transcend is a node command-line utility. Installing node is outside the scope of this tutorial, but check out http://nodejs.org/ for more information.

Use `npm` to install the command-line utility:

```bash
$ sudo npm install transcend -g
```
    
The `-g` places it in your PATH so you can access the `transcend` command anywhere.

In any directory, preferably somewhere related to your website or JavaScript source code, create a `transcend.json` configuration file:

```json
{
	"input": "./source",
	"output": "./build"
}
```

The "input" and "output" properties are the only two required values in this file. The paths to the directories are relative to the location of the configuration file.

Once you have created the configuration file, run the `transcend` command in the same directory as the configuration file:

```bash
$ transcend compile
```

The `compile` command runs the Transcend processor once and exits. Alternatively, you can `transcend watch` to continuously monitor the input directory for changes.


Why?
----

In general, most websites consist of many HTML pages that each load a set of JavaScript files.  Some JavaScript files are needed on nearly every page, while others are only needed on a single page.  Some files fall somewhere in between this, being needed on a certain subset of pages.

The traditional approach to loading JavaScript files on an HTML page has been to **load each individual JavaScript file on every page that needs it, with a separate &lt;script> tag for each file.** However, this approach results in many HTTP requests which can slow down your page load times. It also places a burden on the developer to maintain every required file reference in the HTML.

An alternative to this would be a tool that concatenates your code together, reducing the number of requests your browser needs to make.  However, concatenating everything into a single file would cause every page to load a lot of code it didn't need.  

Transcend's `require` and `parent` directives work together to make it easy for the developer to indicate what other files are required by a script, and where they should be included to avoid unnecessary page loading overhead.


How?
----

### Basic concepts

Transcend is a command line tool written in node. For quick reference, see [Usage](#Usage) to get up and running.

Your JavaScript source files should reside in an "input" directory. This directory can be named and located wherever you want, just remember that *all** JavaScript files in this directory will be processed by Transcend and written to the "output" directory that you specify.

Transcend will process each of your JavaScript source files, outputting them into a directory of your choosing (see [Usage](#Usage) or [Configuration](#Configuration) to learn how to specify this directory).  These output files are what you should include in your HTML via `<script>` tags.

The file structure of the output directory will be identical to the input directory. The only exceptions to this are as follows:
 
 - Directives (see below) may modify the behavior of the output.
 - Files and directories beginning with an underscore (eg. _jquery.js) will be not be output.


### Directives

Before it outputs your files, Transcend looks for special single-line comments called "directives," which alter how your files are processed. They are not included in the output files.

    //@require jquery.js
    //@parent global.js
    // etc...
    
    some.javascript(here);
    
As you can see, directives are JavaScript comments with the format `//@` + **directive keyword** + **arguments**.

Directives should be the ***only*** thing on a line (other than whitespace, which is allowed before and after the directive).

Transcend comes built-in with a handful of useful directives, but it is possible to extend Transcend with custom directives too.



### Configuration

A configuration JSON file must be placed within your project somewhere. Its exact location is not important, but the "input" and "output" directories that it references  must be relative to the location of the configuration file.

When you run `transcend compile` or `transcend watch`, Transcend will look for the configuration file named `transcend.json` in the current working directory. You can also explicitly set a different path or filename by using the `--config path/to/my-transcend-config.json` parameter.

The following properties can be set in the configuration file:

- `"input"` - The directory containing the source code that Transcend will process.
- `"output"` - The directory where Transcend should output the resulting files.

In addition to these, Transcend plugins may indicate other configuration values that can be specified.



Built-in Directives
---------------------------

### `//@require`

Specifies a dependency of one JavaScript file on another. The referenced file will be included into the output of the current file, with special care taken to recursively include any sub-dependencies, and not duplicate any required files within a single output file.

Usage:

    //@require singleFile.js						(in same directory as current file)
	//@require multipleFiles.js, multipleFiles.js	
	//@require ../relative/filename.js				(relative to current file)
	//@require /absolute/filename.js				(relative to input folder root)

Notes: 
- `.js` extensions are optional. Underscore (_) prefix is also optional if the file has one.

- Multiple files can be specified using a comma-separated list, or with multiple //@require directives.
 
- Paths are relative to the directory of the current file. However, if the path begins with a slash, it is relative to the root input folder.



Consider the following scenario:
	
**_jquery.js**:

	... jQuery library ...

**_mywidget.js**:

	//@require jquery.js
	
	... my custom widget ...
	
**home.js**:
			
	//@require jquery.js
	//@require jquery.myplugin.js

    ... my homepage javascript ...
    


In this scenario, home.js will be the only file output (the other two files begin with an underscore), and it will
include a copy of _jquery.js and _mywidget.js:

home.js [output]:

    ... jQuery library ...
    
	... my custom widget ...
	
	... my homepage javascript ...
	
Notice how `home.js` only includes `_jquery.js` once, even though it was included by both `_mywidget.js` and `home.js`.


##### Require all your dependencies!

Keep in mind that `//@require` does not simply copy-and-paste the contents of one file into another. A better way to think of the `//@require` directive is as a dependency manager -- any file that your code depends on should be indicated at the top of the file.  It's a great self-documentation feature, too.

You might have noticed in the above example that `home.js` explicitly indicates its dependency on jQuery even though it would have been included anyway due to `_mywidget.js`'s dependency on it.  Since it is likely that `home.js` is using other jQuery features, it is correct for `home.js` to require it as a dependency for a couple reasons:

 - It is clear in the source code that home.js depends on jquery.js (independent of its dependency on "mywidget"). 
 
 - If the developer decides to remove the dependency on "mywidget", they will not  lose the dependency on jQuery.

Even though you `//@require`'d jQuery more than once, it was only output *once* to the built home.js file.  Transcend will never include a required file more than once.


--

### `//@parent`

Parent files contain code that is common to a set of "child" JavaScript files.  For example, a set of files that all have a dependency on jQuery would benefit from having the jQuery library moved into a common file rather than included in each one. This parent file would then be included as its own &lt;script> tag in your html, benefiting from caching across page loads.

The `parent` directive lets you specify the JavaScript file that `require` includes should "bubble up to" if they are required by more than one file with the same parent.

**Usage:**

	//@parent global.js							(global.js located in same directory)
	//@parent ../relative/filename.js			(relative to current file)
	//@parent /absolute/filename.js				(relative to source folder root)

`//@parent` works along with `//@require` to output files that contain the dependencies that are common to multiple child files.  A parent file's children are examined for common dependencies (i.e. `//@require` directives), and those dependencies are included into parent file instead of the child.

For example, imagine you had three JavaScript files, **page1.js**, **page2.js**, and **global.js**.  

**global.js:**

	... Global js file ...
	
**page1.js:**

	//@parent global.js
	//@require jquery.js
	
	... Page 1 ...
	
**page2.js:**

	//@parent global.js
	//@require jquery.js
	//@require widget.js

	... Page 2 ...
	

	
Both `page1.js` and `page2.js` include jQuery as a dependency. Because `global.js` is the parent of both files, `global.js` will include jQuery, instead of `page1.js` and `page2.js` both containing a copy.  `page2.js` also required `widget.js`, but since it was not common to both files, it will only be included in the output of `page2.js`.

Each of your html pages would include one of the *page* files (which would only include code pertinent to those pages), as well as global.js (which will include code common to all pages).


--

### `//@if`, `//@else`, `//@elseif`, `//@endif`

Transcend supports conditional directives that allow you to output sections of code based on configuration parameters.  This might be useful, for example, when you want to log debugging output in development environments but not in production.

**Usage:**

Configuration file (transcend.json):

	{
		...
		"environment": "local",
		"myValues": { "foo": "bar" }
	}


my-file.js

	//@if environment == "local"
	
		console.log('debugging');
	
	//@else
	
		more code...

	//@endif
	

In the above code, the first segment will only be output if the configuration variable named "environment" is equal to "local". Otherwise, the second segment will be output.

The expression after the `//@if` or `//@elseif` directive can be any valid JavaScript expression. Any properties specified in the configuration file will be available to these expressions. Top-level properties becomes local variables; any nested objects can be accessed just like you would in JavaScript:

	//@if environment == "local"
	//@elseif myValues.foo == "bar"

