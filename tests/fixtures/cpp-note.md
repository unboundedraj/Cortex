---
title: "C++"
date: 2026-10-15
tags: ["C++"]
---

## Introduction

C++ is a general-purpose programming language developed by **Bjarne Stroustrup** as an extension of C.  
C++ is a programming language known for its fast speed, low level memory management and is often taught as first programming language.  
Syntax similarity with C, Java, and C# makes it easier to switch languages.  
C++ is machine-independent at the **source code level**, but machine-dependent at the **compiled executable level**.  
C++ provides low-level access to system resources  
**Direct Memory Manipulation:** C++ uses pointers, which are variables that store the exact physical memory addresses of data. This allows developers to read from, write to, or manipulate specific locations in the RAM directly.  
**Manual Memory Management:** Unlike languages with automatic garbage collection (like Java or Python), C++ requires developers to explicitly allocate and free memory (using `new` and `delete`). This gives precise control over when resources are consumed and released.

---

The below C++ code shows the basic structure of a program.

```cpp
#include <iostream>
using namespace std;

int main() {
    cout << "Hello, World!";
    return 0;
}
```

- **Header File:** #include &lt;iostream&gt; adds input/output objects (cin, cout, etc.) via the preprocessor. Common headers: fstream (files), string (strings), vector (STL), bits/stdc++.h (all-in-one).
- **Namespace Declaration:** using namespace std; allows direct use of standard names like "cout" without std::
- **Main Function:** int main() is the program’s entry point; execution starts here and returns an integer with return 0 mean successful execution

**Comments:** // for single line, /\*....\*/ for multi-line are ignored by the compiler and used only for code documentation.

## Data types

**1. Built-in (Primitive) Data Types**  
These are the fundamental data types native to the C++ compiler.

- **Integer (**`int`**):** Stores whole numbers without decimals. Typically requires 4 bytes of memory. Example: `int age = 25;`
- **Character (**`char`**):** Stores a single character and requires 1 byte of memory. Characters are enclosed in single quotes. Example: `char grade = 'A';`
- **Boolean (**`bool`**):** Stores logical values, taking 1 byte of memory. It can only hold `true` (1) or `false` (0). Example: `bool is_valid = true;`
- **Floating-Point (**`float`**):** Stores single-precision decimal numbers. Typically requires 4 bytes of memory. Example: `float pi = 3.14f;`
- **Double Floating-Point (**`double`**):** Stores double-precision decimal numbers for higher accuracy. Typically requires 8 bytes of memory. Example: `double precise_pi = 3.14159265;`
- **Void (**`void`**):** Represents an absence of a value. It is primarily used for functions that do not return any data.

*Note on Modifiers:* C++ allows you to modify the size or range of these primitive types using **type modifiers**: `signed`, `unsigned`, `short`, and `long`. For instance, an `unsigned int` only holds positive numbers, effectively doubling its positive range, while a `long long` increases the storage capacity for massive integers.

**2. Derived Data Types:**  
These types are constructed by modifying or grouping built-in data types.

- **Arrays:** A collection of elements of the same data type stored in contiguous memory locations. Example: `int scores[5] = {90, 85, 92, 88, 95};`
- **Pointers:** Variables that store the physical memory address of another variable rather than a direct value. Example: `int* ptr = &age;`
- **References:** An alias or alternative name for an already existing variable. Example: `int& ref = age;`
- **Functions:** A block of code that performs a specific task and returns a specific data type (or `void`).

**3. User-Defined Data Types**  
These are custom data types defined by the programmer to group disparate data together or create complex architectural structures.

- **Structures (**`struct`**):** Groups variables of *different* data types under a single name. Elements are accessed via dot notation.
- **Classes (**`class`**):** The foundation of C++ object-oriented programming. Similar to a `struct`, but it encapsulates both data variables and member functions, with data typically hidden via access modifiers (`private`, `public`, `protected`).
- **Unions (**`union`**):** Similar to a `struct`, but all members share the exact same memory location. The size of the union is determined by its largest member, and it can only hold one member's value at a time.
- **Enumerations (**`enum`**):** Creates a customized data type consisting of a set of named integer constants, improving code readability. Example: `enum Color { RED, GREEN, BLUE };`
- **Typedef (**`typedef`**):** Allows you to create a new alias or nickname for an existing data type. Example: `typedef unsigned long ulong;`

## **Data Type Modifiers**

**short:** Specifies a smaller integer type when supported.  
**long:** Specifies an integer type with at least as much storage as int.  
**signed:** Allows an integer type to represent both positive and negative values.  
**unsigned:** Allows an integer type to represent only non-negative values and provides a larger positive range

## **Rules For Naming Variable**

The names given to a variable are called [**identifiers**](https://www.geeksforgeeks.org/cpp/cpp-identifiers/). There are some rules for creating these identifiers (names):

- A name can only contain **letters** (A-Z or a-z), **digits** (0-9), and **underscores (\_)**.
- It should start with a **letter or an underscore only.**
- It is case sensitive.
- The name of the variable should not contain any whitespace and special characters (i.e. #, $, %, \*, etc).
- We cannot use [**C++ keyword**](https://www.geeksforgeeks.org/cpp/cpp-keywords/) (e.g. float, double, class) as a variable name.
  ## **C++ Operator Types**

  C++ operators are classified into **6 types** on the basis of type of operation they perform:

## **Arithmetic Operators**

[**Arithmetic operators**](https://www.geeksforgeeks.org/cpp/cpp-arithmetic-operators/) are used to perform arithmetic or mathematical operations on the operands. For example, '**+**' is used for addition.

- **Addition**, +, Adds two operands
- **Subtraction**, -, Subtracts second operand from the first
- **Multiplication**, \*, Multiplies two operands
- **Division**, /, Divides first operand by the second operand
- **Modulo Operation**, %, Returns the remainder of an integer division
- **Increment**, ++, Increases the value of operand by 1
- **Decrement**, --, Decreases the value of operand by 1

> **++a** and **a++**, both are increment operators, however, both are slightly different. In **++a**, the value of the variable is incremented first and then it is used in the program. In **a++**, the value of the variable is assigned first and then it is incremented. Similarly happens for the decrement operator.

## **Relational Operators**

[**Relational operators**](https://www.geeksforgeeks.org/c/relational-operators-in-c/) are used for the comparison of the values of two operands. For example, '&gt;' check right operand is greater.

- **Is Equal To**, ==, Checks if both operands are equal
- **Greater Than**, &gt;, Checks if the first operand is greater than the second operand
- **Greater Than or Equal To**, &gt;=, Checks if the first operand is greater than or equal to the second operand
- **Less Than**, &lt;, Checks if the first operand is lesser than the second operand
- **Less Than or Equal To**, &lt;=, Checks if the first operand is lesser than or equal to the second operand
- **Not Equal To**, !=, Checks if both operands are not equal

## **Logical Operators**

[**Logical operators**](https://www.geeksforgeeks.org/c/relational-operators-in-c/) are used to combine two or more conditions or constraints or to complement the evaluation of the original condition in consideration. The result returns a Boolean value, i.e., true or false.

- **Logical AND**, &amp;&amp;, Returns true only if all the operands are true or non-zero
- **Logical OR**, ||, Returns true if either of the operands is true or non-zero
- **Logical NOT**, !, Returns true if the operand is false or zero

## **Bitwise Operators**

[**Bitwise operators**](https://www.geeksforgeeks.org/cpp/cpp-bitwise-operators/) are works on bit-level. So, compiler first converted to bit-level and then the calculation is performed on the operands.

- **Binary AND**, &amp;, Copies a bit to the result if it exists in both operands
- **Binary OR**, |, Copies a bit to the result if it exists in any of the operands
- **Binary XOR**, ^, Copies the bit to the result if it is present in either of the operands but not both
- **Left Shift**, &lt;&lt;, Shifts the value to the left by the number of bits specified by the right operand
- **Right Shift**, &gt;&gt;, Shifts the value to the right by the number of bits specified by the right operand
- **One's Complement**, `~`, Changes binary digits 1 to 0 and 0 to 1

> **Note:** Only char and int data types can be used with Bitwise Operators.

## **Assignment Operators**

[**Assignment operators**](https://www.geeksforgeeks.org/cpp/cpp-assignment-operators/) are used to assign value to a variable. We assign the value of right operand into left operand according to which assignment operator we use.  

- **Assignment**, =, Assigns the value on the right to the variable on the left
- **Add and Assignment**, +=, Adds the right operand to the left operand and assigns the result to the left operand
- **Subtract and Assignment**, -=, Subtracts the right operand from the left operand and assigns the result to the left operand
- **Multiply and Assignment**, \*=, Multiplies the left operand by the right operand and assigns the result to the left operand
- **Divide and Assignment**, /=, Divides the left operand by the right operand and assigns the result to the left operand

## **Ternary or Conditional Operators**

[**Conditional operator**](https://www.geeksforgeeks.org/cpp/cpp-ternary-or-conditional-operator/) returns the value, based on the condition. This operator takes **three operands**, therefore it is known as a **Ternary Operator**.

```cpp
Expression1 ? Expression2 : Expression3
```

In the above statement:

- The ternary operator **?** determines the answer on the basis of the evaluation of **Expression1**.
- If **Expression1** is true, then **Expression2** gets evaluated.
- If **Expression1** is false, then **Expression3** gets evaluated.

## **Miscellaneous Operators**

**Scope Resolution Operator (::)** in C++ is used to identify and specify the context (or scope) to which a variable, function, or class belongs. It directs the compiler to look for an identifier within a specific namespace, class, or the global scope.

1. Accessing Global Variables

```cpp
int x = 100; // Global variable

void printX() {
    int x = 10; // Local variable
    cout << x;   // Prints 10 (local)
    cout << ::x; // Prints 100 (global)
}
```

2. Defining Class Methods Externally

```cpp
class Rectangle {
public:
    int area(int w, int h); // Declaration only
};

// Definition outside the class
int Rectangle::area(int w, int h) {
    return w * h;
}
```

3. Accessing Static Class Members  
Static variables and functions belong to the class itself rather than a specific object instance. They are accessed using the class name and the scope resolution operator.

```cpp
class Counter {
public:
    static int count;
};

// Initializing the static variable outside the class
int Counter::count = 0;
```

---

  
[**sizeof operator**](https://www.geeksforgeeks.org/cpp/cpp-sizeof-operator/) is a unary operator used to compute the size of its operand or variable in bytes. For example,

```cpp
sizeof (char);
sizeof (var_name);
```

[**Comma operator**](https://www.geeksforgeeks.org/cpp/comma-in-cpp/) is a binary operator that is used for multiple purposes. It is used as a separator or used to evaluate its first operand and discards the result; it then evaluates the second operand and returns this value (and type).

```cpp
int n = (m+1, m-2, m+5);
int a, b, c;
```

[**Addressof operator**](https://www.geeksforgeeks.org/cpp/cpp-pointer-operators/) is used to find the memory address in which a particular variable is stored. In C++, it is also used to create a [**reference**](https://www.geeksforgeeks.org/cpp/references-in-cpp/).

```
&var_name;
```

> \* is used for dereferencing a pointer

[**Dot operator**](https://www.geeksforgeeks.org/c/dot-operator-in-c/) is used to access members of structure variables or class objects using their object names.

```
obj . member;

```

[**Casting operators**](https://www.geeksforgeeks.org/cpp/casting-operators-in-cpp/) are used to convert the value of one data type to another data type. For example, for an integer value x:

```
(float)x
static_cast<float>(x)
```

---