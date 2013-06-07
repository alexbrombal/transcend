Transcend
=========


### Contents

- [Introduction](#introduction)
- [Usage](#usage)
- [Why?](#why)
- [How?](#how)
   - [Basic concepts](#basic-concepts)
   - [Directives](#directives)
- [Types of Directives](#types-of-directives)
   - [//@require](#require)
   - [//@master](#master)
   - [//@if, //@else, //@elseif, //@endif](#if-else-elseif-endif)
      - [Configuration](#configuration)
         - [Configuration files](#configuration-files)
         - [Configuration parameters](#configuration-parameters)


### Introduction

Transcend is a JavaScript preprocessor that allows you to optimize JavaScript files for your website:

- Specify your files' dependencies, and Transcend will intelligently concatenate files together without duplicating anything.
- Create "master" JavaScript files that will examine the dependencies of other files and compile all common dependencies into a single source.
- Create configurations that will adapt the build settings for your development, production, and other environments.
- Add conditional comments that control the output of your JavaScript sources based on configuration variables.
- Minify the output based on configuration settings.

Transcend works by reading an input directory of your choosing, processing the [directive comments]
(#directives) found within the files, and then writing all the processed files to a separate output directory.

<br/><br/>

![Example](https://raw.github.com/alexbrombal/transcend/master/site/example.png)

<br/>

You'll notice a few things about this scenario:

- `master.js` specifies that it is the master file for `home.js` and `interior.js` (the .js extensions are optional).  This causes `master.js` to include any common dependencies of its sources (in this case, jQuery is the common dependency).
- `mywidget.jquery.js` remains the only dependency of `home.js`, so it is included there.
- `mywidget.jquery.js` has a dependency on jQuery, but since the master file included it already, `jquery.js` is not included a second time.

## Usage

    sudo npm install transcend -g
    
(the `-g` places it in your PATH so you can access the `transcend` command anywhere)

    transcend [--watch] [input-dir] [output-dir]
    
Example:

    cd /path/to/js/
    transcend --watch ./src ./build
    
This will cause transcend to monitor `/path/to/js/src` for changes and output files to `/path/to/js/build`.



Why?
----

In general, most websites consist of many HTML pages that each load a set of JavaScript files.  Some JavaScript files are needed on nearly every page, while others are only needed on a single page.  Some files fall somewhere in between this, being needed on a certain subset of pages.

The traditional approach to loading JavaScript files on an HTML page has been to **load each individual JavaScript file on every page that needs it, with a separate &lt;script> tag for each file.** However, this approach results in many HTTP requests which can slow down your page load times.

An alternative to this would be a tool that concatenates your code together, reducing the number of requests your browser needs to make.  However, concatenating everything into a single file would cause every page to load a lot of code it didn't need.  

A tool was needed that would concatenate JavaScript code in a way that would basically output two types of files: those that are common to many pages, and those that are needed by only a single page.  The tool also needed to do this in a way that doesn't require the developer to keep track of the associations between files in a tedious and error-prone manner.


How?
----

### Basic concepts

Transcend is a command line tool written in nodejs. For quick reference, see [Usage](#Usage) to get up and running.

Your JavaScript source files should reside in a "source" directory of some kind. This directory can be named whatever you want and be located wherever you desire, however keep in mind that all JavaScript files in this directory will be processed by Transcend.

Transcend will process each of your JavaScript source files, outputting them into a single directory of your choosing (see [Usage](#Usage) to learn how to specify this directory).  These output files are what you should include in your HTML via `<script>` tags (or other more obscure means).

Your source folders and files will be processed & output on a one-to-one basis. That is, the file structure of the input directory will be mirrored identically to the output directory. The only exceptions to this are as follows:
 
 - Directives (see below) may modify the behavior of the output.
 - Files beginning with an underscore (eg. _jquery.js) will be not be output.


### Directives

Your JavaScript source files will be regular .js files, but Transcend will look for special single-line comments called "directives" in order to process your files.

Directives are the core feature of Transcend. They are essentially C-style preprocessor directions that affect the output of your JavaScript files, without being included in the output themselves.

    //@require somefile.js
    //@master otherfile.js
    // etc...
    
    some.javascript(here);
    
As you can see, directives come in the form of `//@` + a directive keyword + directive-specific arguments.

Directives should be the ***only*** thing on a line (other than whitespace, which is allowed before and after the directive).

Transcend comes with a handful of useful directives, but it is possible to extend Transcend with custom directives too.



Types of Directives
---------------------------

### //@require

Usage:

    //@require singleFile.js						(in same directory as current file)
	//@require multipleFiles.js, multipleFiles.js	
	//@require ../relative/filename.js				(relative to current file)
	//@require /absolute/filename.js				(relative to source folder root)

Notes: 
- `.js` extensions are optional. Underscore (_) prefix is also optional if the file has one.

- Multiple files can be specified using a comma-separated list, or with multiple //@require directives.
 
- Relative paths are resolved against the directory of the current file. Absolute paths (beginning with a slash) are resolved against the root source folder.


The `//@require` directive essentially includes one javascript file into another.  However, `//@require` is also careful not to include a file more than once.


Consider the following scenario:
	
**_jquery.js**:

	/* This is the jQuery library */

**_jquery.myplugin.js**:

	//@require jquery.js
	/* This is my jQuery plugin */
	
**home.js**:
			
	//@require jquery.js<br/>
	//@require jquery.myplugin.js<br/>
	/* This is my home page javascript */


In this scenario, home.js will be output with one copy of jquery.js and jquery.myplugin.js:

home.js [output]:

    /* This is the jQuery library */
	/* This is my jQuery plugin */
	/* This is my home page javascript */
	
Notice how `home.js` only includes the jQuery plugin once, even though it was included by both `myplugin.jquery.js` and `jquery.js`.


##### Require all your dependencies!

Keep in mind that `//@require` does not simply copy-and-paste the contents of one file into another. A better way to think of the `//@require` directive is as a dependency manager -- any file that your code depends on should be indicated at the top of the file.  It's a great self-documentation feature, too.

You might have noticed in the above example that home.js explicitly indicated its dependency on jQuery even though it would have been included anyway due to *myplugin*'s dependency on it.  Since it is likely that home.js is using other jQuery features (besides the one custom plugin), it is correct for home.js to require it as a dependency for a couple reasons:

 - It is clear in the source code that home.js depends on jquery.js (independent of its dependency on "myplugin"). 
 
 - Should you decide to remove the dependency on your custom jQuery plugin, you will no longer lose the dependency on jQuery.

Even though you //@require'd jQuery more than once, it was only output *once* to the built home.js file.  Transcend will never include a required file more than once.


--

### //@master

Master files contain code that is common to a set of files.  For example, a set of files that all have a dependency on jQuery would benefit from having the jQuery library moved into a common file rather than included in each one. This master file would then be included as a separate &lt;script> tag in your html, allowing it to be cached across page loads.

**Usage:**

	//@master file1.js, file2.js	
	//@master ../relative/filename.js			(relative to current file)
	//@master /absolute/filename.js				(relative to source folder root)

`//@master` works along with `//@require` to produce files that contain code that is common among a subset of JavaScript sources.  Any files you specify as parameters to a `//@master` directive are examined for common dependencies (i.e. `//@require` directives), and those dependencies are included into master file and removed from the sources that required them.

For example, imagine you had three javascript files, **page1.js**, **page2.js**, and **page3.js**.  You also have a **master.js** file, that contains a `//@master` directive for all three files:

**master.js:**

	//@master page1, page2, page3
	
**page1.js:**

	//@require jquery.js
	..
	
**page2.js:**

	//@require jquery.js
	//@require something.js
	..
	
**page3.js:**

	//@require jquery.js
	..

	
All three pageX.js files include jquery as a dependency. Therefore, **master.js** will include jquery.js when it is processed, and all three pageX.js files will not.  However, **page2.js** required something.js as well, but since it was not common to all three files, it will still only be included in the output of page2.js.

Now each of your html sources can include one of the *page* files (which will only include code pertinent to those pages), and master.js (which will include code common to all pages, and the browser will cache it upon subsequent requests).


--

### //@if, //@else, //@elseif, //@endif

Transcend supports conditional directives that allow you to output sections of code based on configuration parameters.  For example, this might be useful when you want to log debugging output in development environments but not in production.

**Usage:**

	//@if environment == "local"
	
		console.log('debugging');
	
	//@else
	
		more code...

	//@endif
	
To build this, run:
	
	transcendjs --environment=local ./source ./output

In the above code, the first segment will only be output if the configuration variable named "environment" is equal to "local". Otherwise, the second segment will be output.

The expression after the `//@if` (or `//@elseif`) directives can be any valid JavaScript expression.  Variables referenced must be defined on the command line or in configuration files (see [Configuration](#Configuration) below).

#### Configuration

In order for conditional directives to be useful, they must be able to test for predefined values.  These values can be specified in two ways: configuration files, or command-line arguments.

##### Configuration Files

A configuration file can be placed in the root of your source directory. This file should contain a JSON object; any properties of this object will be made available to the expressions used in `//@if` or `//@elseif` directives.

By default, Transcend will look for a file named **transcend.json**, but you can name your file anything and specify it as the `config` command line parameter:

	transcendjs --config=myconfig.json ./source ./output

Specifying your filename is useful if you want to have more than one configuration file (eg. `debug.transcend.json` and `prod.transcend.json`).

For example, take the following **transcend.json** file:

	{
		"environment": "local",
		"myValues": {
			"foo": "bar"
		}
	}

The configuration file can be any valid JSON object. Currently, there are no predefined values that have any effect on Transcend's output.  

To access any of these values from your `//@if` or `//@elseif` expressions, each top-level property becomes a local variable; any nested objects can be accessed just like you would in JavaScript:

	//@if environment == "local"
	//@elseif myValues.foo == "bar"


##### Configuration parameters

You can also pass configuration values to the command-line. These values override any matching values in the configuration file.

	transcendjs --environment=prod ./source ./output
	
This will set the "environment" variable to "prod", overwriting any "environment" property in your configuration file.

You can also set nested properties using dot-notation:

	transcendjs --myValues.foo=bar ./source ./output
	
Note that values do not need to be quoted. Values like `true` or `false` and integers will be automatically cast to their appropriate values.


